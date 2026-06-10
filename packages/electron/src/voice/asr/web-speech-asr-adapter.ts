import type { ASRAdapter, ASRConfig } from './types.js';
import type { ASRResult } from '@codepilot/core/voice';

export class WebSpeechASRAdapter implements ASRAdapter {
  readonly engineType = 'web-speech' as const;
  private recognition: SpeechRecognition | null = null;
  private resultCallback: ((result: ASRResult) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;
  private endCallback: (() => void) | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof SpeechRecognition !== 'undefined' || typeof webkitSpeechRecognition !== 'undefined';
  }

  async initialize(config: ASRConfig): Promise<void> {
    const SpeechRecognitionClass = typeof SpeechRecognition !== 'undefined' ? SpeechRecognition : webkitSpeechRecognition;
    if (!SpeechRecognitionClass) throw new Error('Web Speech API not available');

    this.recognition = new SpeechRecognitionClass();
    this.recognition.lang = config.language;
    this.recognition.continuous = config.continuous;
    this.recognition.interimResults = config.interimResults;
  }

  async start(): Promise<void> {
    if (!this.recognition) throw new Error('Not initialized');

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (this.resultCallback) {
          this.resultCallback({
            transcript: result[0].transcript,
            isFinal: result.isFinal,
            confidence: result[0].confidence,
            engineType: 'web-speech',
          });
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (this.errorCallback) this.errorCallback(new Error(event.error));
    };

    this.recognition.onend = () => {
      if (this.endCallback) this.endCallback();
    };

    this.recognition.start();
  }

  async stop(): Promise<void> { this.recognition?.stop(); }
  async abort(): Promise<void> { this.recognition?.abort(); }
  async dispose(): Promise<void> { this.recognition = null; }

  onResult(callback: (result: ASRResult) => void): void { this.resultCallback = callback; }
  onError(callback: (error: Error) => void): void { this.errorCallback = callback; }
  onEnd(callback: () => void): void { this.endCallback = callback; }
}
