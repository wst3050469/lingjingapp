import type { ASREngineType, TTSEngineType, VoiceEngineConfig, VoiceEngineAvailability } from '@codepilot/core/voice';
import type { ASRAdapter } from './asr/types.js';
import type { TTSAdapter } from './tts/types.js';
import { DEFAULT_VOICE_ENGINE_CONFIG } from '@codepilot/core/voice';

export class VoiceEngineManager {
  private config: VoiceEngineConfig;
  private currentASR: ASRAdapter | null = null;
  private currentTTS: TTSAdapter | null = null;
  private adapters: Map<string, ASRAdapter | TTSAdapter> = new Map();

  constructor(config?: Partial<VoiceEngineConfig>) {
    this.config = { ...DEFAULT_VOICE_ENGINE_CONFIG, ...config };
  }

  registerASRAdapter(adapter: ASRAdapter): void {
    this.adapters.set(`asr:${adapter.engineType}`, adapter);
  }

  registerTTSAdapter(adapter: TTSAdapter): void {
    this.adapters.set(`tts:${adapter.engineType}`, adapter);
  }

  async getASRAdapter(type?: ASREngineType): Promise<ASRAdapter | null> {
    const targetType = type ?? this.config.asrEngine;
    const adapter = this.adapters.get(`asr:${targetType}`) as ASRAdapter;
    if (adapter && await adapter.isAvailable()) {
      return adapter;
    }
    return this.getAvailableASR();
  }

  async getTTSAdapter(type?: TTSEngineType): Promise<TTSAdapter | null> {
    const targetType = type ?? this.config.ttsEngine;
    const adapter = this.adapters.get(`tts:${targetType}`) as TTSAdapter;
    if (adapter && await adapter.isAvailable()) {
      return adapter;
    }
    return this.getAvailableTTS();
  }

  async getAvailableASR(): Promise<ASRAdapter | null> {
    for (const type of this.config.asrFallbackChain!) {
      const adapter = this.adapters.get(`asr:${type}`) as ASRAdapter;
      if (adapter && await adapter.isAvailable()) {
        return adapter;
      }
    }
    return null;
  }

  async getAvailableTTS(): Promise<TTSAdapter | null> {
    for (const type of this.config.ttsFallbackChain!) {
      const adapter = this.adapters.get(`tts:${type}`) as TTSAdapter;
      if (adapter && await adapter.isAvailable()) {
        return adapter;
      }
    }
    return null;
  }

  async getAvailability(): Promise<VoiceEngineAvailability> {
    const checkASR = async (type: ASREngineType) => {
      const adapter = this.adapters.get(`asr:${type}`) as ASRAdapter;
      return adapter ? await adapter.isAvailable() : false;
    };
    const checkTTS = async (type: TTSEngineType) => {
      const adapter = this.adapters.get(`tts:${type}`) as TTSAdapter;
      return adapter ? await adapter.isAvailable() : false;
    };

    return {
      webSpeechASR: await checkASR('web-speech'),
      webSpeechTTS: await checkTTS('web-speech'),
      nativeASR: await checkASR('native'),
      nativeTTS: await checkTTS('native'),
      cloudASR: await checkASR('cloud'),
      cloudTTS: await checkTTS('cloud'),
    };
  }

  getConfig(): VoiceEngineConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<VoiceEngineConfig>): void {
    this.config = { ...this.config, ...partial };
  }
}
