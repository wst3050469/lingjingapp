import type { TTSAdapter, TTSConfig, TTSPlaybackHandle } from './types.js';

export class WebSpeechTTSAdapter implements TTSAdapter {
  readonly engineType = 'web-speech' as const;
  private config: TTSConfig | null = null;
  private stateCallback: ((state: 'speaking' | 'paused' | 'idle') => void) | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof speechSynthesis !== 'undefined';
  }

  async initialize(config: TTSConfig): Promise<void> {
    this.config = config;
  }

  async speak(text: string): Promise<TTSPlaybackHandle> {
    if (!this.config) throw new Error('Not initialized');

    let cancelFn: (() => void) | null = null;
    const onDone = new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.config!.language;
      utterance.rate = this.config!.rate;
      utterance.volume = this.config!.volume / 100;

      utterance.onend = () => {
        this.stateCallback?.('idle');
        resolve();
      };
      utterance.onerror = (event) => {
        this.stateCallback?.('idle');
        if (event.error !== 'canceled') reject(new Error(event.error));
        else resolve();
      };

      cancelFn = () => {
        speechSynthesis.cancel();
        resolve();
      };

      this.stateCallback?.('speaking');
      speechSynthesis.speak(utterance);
    });

    return { onDone, cancel: cancelFn ?? (() => {}) };
  }

  async stop(): Promise<void> { speechSynthesis.cancel(); this.stateCallback?.('idle'); }
  async pause(): Promise<void> { speechSynthesis.pause(); this.stateCallback?.('paused'); }
  async resume(): Promise<void> { speechSynthesis.resume(); this.stateCallback?.('speaking'); }
  async dispose(): Promise<void> { speechSynthesis.cancel(); }
  onStateChange(callback: (state: 'speaking' | 'paused' | 'idle') => void): void { this.stateCallback = callback; }
}
