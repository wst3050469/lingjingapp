// Stub: voice module
export const DEFAULT_VOICE_ENGINE_CONFIG = {
  asrEngine: 'web-speech',
  ttsEngine: 'web-speech',
  asrFallbackChain: ['web-speech', 'cloud', 'native'],
  ttsFallbackChain: ['web-speech', 'cloud', 'native'],
  language: 'zh-CN',
  autoDetect: true,
};
