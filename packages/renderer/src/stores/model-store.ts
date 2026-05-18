import { create } from 'zustand';

interface CloudProvider {
  key: string;
  name: string;
  color: string;
  models: string[];
}

const CLOUD_PROVIDERS: CloudProvider[] = [
  { key: 'openai',    name: 'OpenAI',    color: 'blue',   models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'] },
  { key: 'anthropic', name: 'Anthropic', color: 'orange', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'] },
  { key: 'deepseek',  name: 'DeepSeek',  color: 'cyan',   models: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'] },
  { key: 'qwen',      name: '通义千问',   color: 'purple', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'] },
  { key: 'kimi',      name: 'Kimi',      color: 'pink',   models: ['moonshot-v1-8k', 'moonshot-v1-128k'] },
  { key: 'glm',       name: '智谱 GLM',  color: 'teal',   models: ['glm-5.1', 'glm-4'] },
  { key: 'doubao',    name: '豆包',      color: 'rose',   models: ['doubao-seed-2-0-pro-260215'] },
  { key: 'baidu',     name: '百度千帆',   color: 'red',    models: ['ernie-4.0-8k', 'ernie-speed-8k'] },
  { key: 'tencent',   name: '腾讯混元',   color: 'sky',    models: ['hunyuan-pro', 'hunyuan-lite'] },
  { key: 'minimax',   name: 'MiniMax',   color: 'amber',  models: ['abab6.5s-chat', 'abab5.5-chat'] },
  { key: 'jinmo',     name: '浙江金默',   color: 'green',  models: ['qwen3.6:27b'] },
  { key: 'gemma',     name: 'Gemma',      color: 'teal',   models: ['gemma4:31b'] },
  { key: 'qwen35b',   name: 'Qwen3.6-35B Q4', color: 'indigo', models: ['batiai/qwen3.6-35b:q4'] },
];

interface ConfiguredProvider {
  key: string;
  name: string;
  color: string;
  models: string[];
}

interface ModelState {
  currentModel: string;
  ollamaModels: string[];
  ollamaConnected: boolean;
  configuredProviders: ConfiguredProvider[];
  loading: boolean;

  fetchOllamaModels: () => Promise<void>;
  setModel: (model: string) => Promise<void>;
  loadCurrentConfig: () => Promise<void>;
}

export const useModelStore = create<ModelState>((set) => ({
  currentModel: '',
  ollamaModels: [],
  ollamaConnected: false,
  configuredProviders: [],
  loading: false,

  fetchOllamaModels: async () => {
    set({ loading: true });
    try {
      const result = await window.electronAPI.ollama.listModels();
      if (result.models && result.models.length > 0) {
        set({
          ollamaModels: result.models.map((m: any) => m.name),
          ollamaConnected: true,
          loading: false,
        });
      } else {
        set({ ollamaModels: [], ollamaConnected: false, loading: false });
      }
    } catch {
      set({ ollamaModels: [], ollamaConnected: false, loading: false });
    }
  },

  setModel: async (model: string) => {
    set({ currentModel: model });
    await window.electronAPI.config.set('model', model);
  },

  loadCurrentConfig: async () => {
    try {
      const config = await window.electronAPI.config.get() as any;
      let currentModel = config?.model || '';
      const apiKeys = config?.apiKeys || {};

      // Validate stored model: if it doesn't match any known model, fall back to a valid one
      const knownModels = new Set<string>();
      for (const p of CLOUD_PROVIDERS) {
        for (const m of p.models) {
          knownModels.add(`${p.key}:${m}`);
        }
      }
      if (currentModel && !knownModels.has(currentModel)) {
        // Could be an old model — switch to first available model for the provider
        const colonIdx = currentModel.indexOf(':');
        const provider = colonIdx > 0 ? currentModel.slice(0, colonIdx) : '';
        const providerDef = CLOUD_PROVIDERS.find(p => p.key === provider);
        if (providerDef && providerDef.models.length > 0) {
          currentModel = `${providerDef.key}:${providerDef.models[0]}`;
        } else {
          // Fall back to first configured model
          currentModel = '';
        }
      }

      // Build list of configured cloud providers (those with API keys)
      const configured: ConfiguredProvider[] = [];
      for (const p of CLOUD_PROVIDERS) {
        if (apiKeys[p.key]) {
          configured.push(p);
        }
      }

      // Also add custom provider if configured
      if (config?.custom?.baseUrl) {
        configured.push({
          key: 'custom',
          name: config.custom.name || '自定义 API',
          color: 'gray',
          models: ['model-name'],
        });
      }

      set({ currentModel, configuredProviders: configured });
    } catch {
      // ignore
    }
  },
}));
