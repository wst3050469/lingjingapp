export type ASREngineType = 'web-speech' | 'native' | 'cloud' | 'websocket';
export type TTSEngineType = 'web-speech' | 'native' | 'cloud' | 'websocket';
export type VoiceSessionState = 'idle' | 'recording' | 'recognizing' | 'processing' | 'broadcasting' | 'confirming';
export type InteractionMode = 'text' | 'voice';
export type VoiceSessionEvent = 'start_recording' | 'vad_speech_end' | 'asr_finalized' | 'agent_done' | 'tts_done' | 'confirmation_done' | 'interrupt' | 'error';
export interface ASRResult {
    transcript: string;
    isFinal: boolean;
    confidence: number;
    engineType: ASREngineType;
}
export interface TTSRequest {
    text: string;
    rate?: number;
    volume?: number;
    language?: string;
}
export interface VoiceEngineConfig {
    asrEngine: ASREngineType;
    ttsEngine: TTSEngineType;
    asrFallbackChain: ASREngineType[];
    ttsFallbackChain: TTSEngineType[];
    language: string;
    ttsRate: number;
    ttsVolume: number;
    autoBroadcast: boolean;
    confirmationWords: string[];
    cancellationWords: string[];
    confirmationTimeoutMs: number;
}
export interface InteractionModeState {
    currentMode: InteractionMode;
    voiceStatus: VoiceSessionState;
    isMicAvailable: boolean;
    isSpeakerAvailable: boolean;
}
export interface VoiceEngineAvailability {
    webSpeechASR: boolean;
    webSpeechTTS: boolean;
    nativeASR: boolean;
    nativeTTS: boolean;
    cloudASR: boolean;
    cloudTTS: boolean;
}
export interface VoiceSession {
    id: string;
    state: VoiceSessionState;
    transcript: string;
    confidence: number;
    startedAt: Date;
    completedAt?: Date;
}
export interface ConfirmationResult {
    result: 'confirmed' | 'cancelled' | 'unrecognized' | 'timeout';
    matchedWord?: string;
    confidence?: number;
}
export declare const DEFAULT_VOICE_ENGINE_CONFIG: VoiceEngineConfig;
//# sourceMappingURL=types.d.ts.map