import type { ASRAdapter, ASRConfig } from './types.js';
import type { ASRResult } from '@codepilot/core/voice';
import { exec } from 'child_process';
import { platform } from 'os';

export class NativeASRAdapter implements ASRAdapter {
  readonly engineType = 'native' as const;
  private resultCallback: ((result: ASRResult) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;
  private endCallback: (() => void) | null = null;

  async isAvailable(): Promise<boolean> {
    const os = platform();
    if (os === 'win32') return true;
    if (os === 'darwin') return true;
    return false;
  }

  async initialize(_config: ASRConfig): Promise<void> {}
  async start(): Promise<void> {
    const os = platform();
    if (os === 'darwin') {
      exec('say -l ?', (error) => {
        if (error && this.errorCallback) this.errorCallback(error);
      });
    }
  }
  async stop(): Promise<void> {}
  async abort(): Promise<void> {}
  async dispose(): Promise<void> {}
  onResult(callback: (result: ASRResult) => void): void { this.resultCallback = callback; }
  onError(callback: (error: Error) => void): void { this.errorCallback = callback; }
  onEnd(callback: () => void): void { this.endCallback = callback; }
}
