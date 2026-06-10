import type { ASRResult, ASREngineType } from '@codepilot/core/voice';

export interface ASRConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
}

export interface ASRAdapter {
  readonly engineType: ASREngineType;
  isAvailable(): Promise<boolean>;
  initialize(config: ASRConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  abort(): Promise<void>;
  dispose(): Promise<void>;
  onResult(callback: (result: ASRResult) => void): void;
  onError(callback: (error: Error) => void): void;
  onEnd(callback: () => void): void;
}
