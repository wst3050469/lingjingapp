export interface VADConfig {
  energyThreshold: number;
  speechOnFrames: number;
  speechOffFrames: number;
  silenceTimeoutMs: number;
  sampleRate: number;
}

export const DEFAULT_VAD_CONFIG: VADConfig = {
  energyThreshold: 0.01,
  speechOnFrames: 3,
  speechOffFrames: 8,
  silenceTimeoutMs: 1500,
  sampleRate: 16000,
};
