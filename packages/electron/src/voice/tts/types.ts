import type { TTSEngineType } from '@codepilot/core/voice';

export interface TTSConfig {
  language: string;
  rate: number;
  volume: number;
}

export interface TTSPlaybackHandle {
  onDone: Promise<void>;
  cancel(): void;
}

export interface TTSAdapter {
  readonly engineType: TTSEngineType;
  isAvailable(): Promise<boolean>;
  initialize(config: TTSConfig): Promise<void>;
  speak(text: string): Promise<TTSPlaybackHandle>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  dispose(): Promise<void>;
  onStateChange(callback: (state: 'speaking' | 'paused' | 'idle') => void): void;
}
