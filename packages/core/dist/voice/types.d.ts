export type ASREngineType = 'web-speech' | 'native' | 'cloud' | 'websocket';
export type TTSEngineType = 'web-speech' | 'native' | 'cloud';

export interface ASRResult {
    transcript: string;
    isFinal: boolean;
    confidence?: number;
    language?: string;
    engineType?: ASREngineType;
}

export interface VoiceEngineConfig {
    asrEngine: ASREngineType;
    ttsEngine: TTSEngineType;
    asrFallbackChain: ASREngineType[];
    ttsFallbackChain: TTSEngineType[];
    vadThreshold: number;
    vadSilenceTimeoutMs: number;
}

export interface VoiceEngineAvailability {
    webSpeechASR: boolean;
    nativeASR: boolean;
    cloudASR: boolean;
    websocketASR: boolean;
    webSpeechTTS: boolean;
    nativeTTS: boolean;
    cloudTTS: boolean;
}

export interface ConfirmationResult {
    result: 'confirmed' | 'cancelled' | 'none' | 'unrecognized';
    matchedWord?: string;
    confidence: number;
}

export const DEFAULT_VOICE_ENGINE_CONFIG: VoiceEngineConfig = {
    asrEngine: 'web-speech',
    ttsEngine: 'web-speech',
    asrFallbackChain: ['web-speech', 'cloud'],
    ttsFallbackChain: ['web-speech', 'cloud'],
    vadThreshold: 0.5,
    vadSilenceTimeoutMs: 1500,
};
//# sourceMappingURL=types.d.ts.map
