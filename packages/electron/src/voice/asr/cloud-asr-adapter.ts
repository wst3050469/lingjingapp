import type { ASRAdapter, ASRConfig } from './types.js';
import type { ASRResult } from '@codepilot/core/voice';

export interface CloudASRConfig {
  apiKey: string;
  endpoint: string;
  language: string;
}

export class CloudASRAdapter implements ASRAdapter {
  readonly engineType = 'cloud' as const;
  private cloudConfig: CloudASRConfig | null = null;
  private resultCallback: ((result: ASRResult) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;
  private endCallback: (() => void) | null = null;
  private ws: WebSocket | null = null;

  constructor(cloudConfig?: CloudASRConfig) {
    this.cloudConfig = cloudConfig ?? null;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.cloudConfig?.apiKey || !this.cloudConfig?.endpoint) return false;
    try {
      const response = await fetch(this.cloudConfig.endpoint.replace(/\/ws.*/, '/health'), { method: 'GET', signal: AbortSignal.timeout(3000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  async initialize(config: ASRConfig): Promise<void> {
    if (!this.cloudConfig) throw new Error('Cloud config not provided');
  }

  async start(): Promise<void> {
    if (!this.cloudConfig) throw new Error('Not configured');
    this.ws = new WebSocket(this.cloudConfig.endpoint);
    this.ws.onmessage = (event) => {
      if (this.resultCallback) {
        const data = JSON.parse(event.data);
        this.resultCallback({
          transcript: data.result ?? '',
          isFinal: data.isFinal ?? false,
          confidence: data.confidence ?? 0,
          engineType: 'cloud',
        });
      }
    };
    this.ws.onerror = () => { this.errorCallback?.(new Error('WebSocket error')); };
    this.ws.onclose = () => { this.endCallback?.(); };
  }

  async stop(): Promise<void> { this.ws?.close(); }
  async abort(): Promise<void> { this.ws?.close(); }
  async dispose(): Promise<void> { this.ws = null; }
  onResult(callback: (result: ASRResult) => void): void { this.resultCallback = callback; }
  onError(callback: (error: Error) => void): void { this.errorCallback = callback; }
  onEnd(callback: () => void): void { this.endCallback = callback; }
}
