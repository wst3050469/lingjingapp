import type { TTSAdapter, TTSConfig, TTSPlaybackHandle } from './types.js';
import { exec } from 'child_process';
import { platform } from 'os';

export class NativeTTSAdapter implements TTSAdapter {
  readonly engineType = 'native' as const;
  private config: TTSConfig | null = null;
  private stateCallback: ((state: 'speaking' | 'paused' | 'idle') => void) | null = null;

  async isAvailable(): Promise<boolean> {
    const os = platform();
    if (os === 'darwin') return true;
    if (os === 'linux') {
      return new Promise<boolean>((resolve) => {
        exec('which espeak-ng', (error) => resolve(!error));
      });
    }
    if (os === 'win32') return true;
    return false;
  }

  async initialize(config: TTSConfig): Promise<void> { this.config = config; }

  async speak(text: string): Promise<TTSPlaybackHandle> {
    const os = platform();
    let cancelFn: (() => void) | null = null;
    const onDone = new Promise<void>((resolve) => {
      const safeText = text.replace(/["'$`\\]/g, '\\$&');
      let cmd: string;

      if (os === 'darwin') {
        const rate = Math.round((this.config?.rate ?? 1) * 175);
        cmd = `say -r ${rate} "${safeText}"`;
      } else if (os === 'linux') {
        cmd = `espeak-ng "${safeText}"`;
      } else {
        cmd = `powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${safeText}')"`;
      }

      const child = exec(cmd, (error) => {
        this.stateCallback?.('idle');
        if (error) resolve();
        else resolve();
      });

      cancelFn = () => { child.kill(); resolve(); };
      this.stateCallback?.('speaking');
    });

    return { onDone, cancel: cancelFn ?? (() => {}) };
  }

  async stop(): Promise<void> { this.stateCallback?.('idle'); }
  async pause(): Promise<void> { this.stateCallback?.('paused'); }
  async resume(): Promise<void> { this.stateCallback?.('speaking'); }
  async dispose(): Promise<void> {}
  onStateChange(callback: (state: 'speaking' | 'paused' | 'idle') => void): void { this.stateCallback = callback; }
}
