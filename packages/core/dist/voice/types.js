export const DEFAULT_VOICE_ENGINE_CONFIG = {
    asrEngine: 'web-speech',
    ttsEngine: 'web-speech',
    asrFallbackChain: ['web-speech', 'native', 'cloud'],
    ttsFallbackChain: ['web-speech', 'native', 'cloud'],
    language: 'zh-CN',
    ttsRate: 1.0,
    ttsVolume: 80,
    autoBroadcast: true,
    confirmationWords: ['确认', '是的', '对的', '好的', 'confirm', 'yes', 'ok'],
    cancellationWords: ['取消', '不要', '不对', 'cancel', 'no', 'abort'],
    confirmationTimeoutMs: 30000,
};
//# sourceMappingURL=types.js.map