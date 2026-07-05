/**
 * 灵境AI - WebSocket ASR 适配器
 *
 * 通过 WebSocket 连接服务器 Whisper 流式端点实现语音识别。
 * 作为 WebSpeech API 不可用时的降级方案（Safari/Firefox/APK）。
 */
import type { ASRAdapter, ASRConfig } from './types.js';
import type { ASRResult } from '@codepilot/core/voice';
import { createHash } from 'crypto';
import { platform } from 'os';

const DEFAULT_WS_URL = 'ws://127.0.0.1:8900/api/v1/asr/stream';

export class WebSocketASRAdapter implements ASRAdapter {
  readonly engineType = 'websocket' as const;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private resultCallback: ((result: ASRResult) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;
  private endCallback: (() => void) | null = null;
  private sessionId: string = '';

  constructor(wsUrl?: string) {
    this.wsUrl = wsUrl ?? process.env.ASR_WS_URL ?? DEFAULT_WS_URL;
  }

  async isAvailable(): Promise<boolean> {
    // WebSocket 适配器在所有平台都可用（只要网络连通）
    // 先做轻量级 check — 只验证 URL 格式
    try {
      new URL(this.wsUrl);
      return true;
    } catch {
      return false;
    }
  }

  async initialize(_config: ASRConfig): Promise<void> {
    this.sessionId = `ws_asr_${Date.now()}_${createHash('md5').update(Math.random().toString()).digest('hex').slice(0, 6)}`;
  }

  async start(): Promise<void> {
    if (this.ws) {
      throw new Error('Already started');
    }

    // 1. 获取麦克风权限
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      throw new Error(`麦克风访问被拒绝: ${err}`);
    }

    // 2. 连接 WebSocket
    this.ws = new WebSocket(this.wsUrl);
    this.ws.binaryType = 'arraybuffer';

    // 3. 等待连接完成后启动音频流
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('WebSocket not created'));

      const timeout = setTimeout(() => reject(new Error('WebSocket 连接超时')), 5000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket 连接失败'));
      };
    });

    // 4. 接收消息
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'interim' && data.text) {
          this.resultCallback?.({
            transcript: data.text,
            isFinal: false,
            confidence: 0.8,
            engineType: 'websocket',
          });
        } else if (data.type === 'final' && data.text) {
          this.resultCallback?.({
            transcript: data.text,
            isFinal: true,
            confidence: 0.9,
            engineType: 'websocket',
          });
          this.endCallback?.();
        } else if (data.type === 'error') {
          this.errorCallback?.(new Error(data.message || 'ASR error'));
        }
      } catch {}
    };

    this.ws.onclose = () => {
      this.endCallback?.();
      this._cleanup();
    };

    this.ws.onerror = () => {
      this.errorCallback?.(new Error('WebSocket 连接异常'));
    };

    // 5. 启动音频流 → PCM 发送
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const input = e.inputBuffer.getChannelData(0);
        // Float32 → PCM16
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this.ws.send(pcm.buffer);
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (err) {
      this._cleanup();
      throw new Error(`音频流初始化失败: ${err}`);
    }
  }

  async stop(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send('__END__');
      } catch {}
    }
    // 不等 final, 让 onclose 触发清理
    this._cleanup();
  }

  async abort(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send('__ABORT__');
        this.ws.close();
      } catch {}
    }
    this._cleanup();
  }

  async dispose(): Promise<void> {
    this._cleanup();
    this.resultCallback = null;
    this.errorCallback = null;
    this.endCallback = null;
  }

  onResult(callback: (result: ASRResult) => void): void { this.resultCallback = callback; }
  onError(callback: (error: Error) => void): void { this.errorCallback = callback; }
  onEnd(callback: () => void): void { this.endCallback = callback; }

  private _cleanup(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }
}
