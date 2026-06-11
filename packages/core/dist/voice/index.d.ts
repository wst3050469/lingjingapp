export interface ASRResult {
    text: string;
    confidence: number;
}
export type ASREngineType = 'web-speech' | 'cloud' | 'native' | 'websocket';
export type TTSEngineType = 'web-speech' | 'cloud' | 'native';
export interface VoiceEngineConfig {
    asrEngine?: ASREngineType;
    ttsEngine?: TTSEngineType;
    asrFallbackChain?: ASREngineType[];
    ttsFallbackChain?: TTSEngineType[];
}
export interface VoiceEngineAvailability {
    asr: Record<string, boolean>;
    tts: Record<string, boolean>;
}
export interface ConfirmationResult {
    confirmed: boolean;
    confidence: number;
}
export declare const DEFAULT_VOICE_ENGINE_CONFIG: VoiceEngineConfig;
//# sourceMappingURL=index.d.ts.map