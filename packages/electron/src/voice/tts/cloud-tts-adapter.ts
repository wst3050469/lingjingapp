import type { TTSAdapter, TTSConfig, TTSPlaybackHandle } from './types.js';

export interface CloudTTSConfig {
  apiKey: string;
  endpoint: string;
}

export class CloudTTSAdapter implements TTSAdapter {
  readonly engineType = 'cloud' as const;
  private config: TTSConfig | null = null;
  private cloudConfig: CloudTTSConfig | null = null;
  private stateCallback: ((state: 'speaking' | 'paused' | 'idle') => void) | null = null;

  constructor(cloudConfig?: CloudTTSConfig) {
    this.cloudConfig = cloudConfig ?? null;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.cloudConfig?.apiKey || !this.cloudConfig?.endpoint) return false;
    return true;
  }

  async initialize(config: TTSConfig): Promise<void> { this.config = config; }

  async speak(text: string): Promise<TTSPlaybackHandle> {
    this.stateCallback?.('speaking');
    const onDone = fetch(this.cloudConfig!.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.cloudConfig!.apiKey}` },
      body: JSON.stringify({ text, language: this.config?.language ?? 'zh-CN', rate: this.config?.rate ?? 1 }),
    }).then(() => { this.stateCallback?.('idle'); });

    return {
      onDone,
      cancel: () => { this.stateCallback?.('idle'); },
    };
  }

  async stop(): Promise<void> { this.stateCallback?.('idle'); }
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
  async dispose(): Promise<void> {}
  onStateChange(callback: (state: 'speaking' | 'paused' | 'idle') => void): void { this.stateCallback = callback; }
}
