// Provider factory - creates LLM provider from model string
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import { DoubaoProvider } from './doubao.js';
/**
 * OpenAI-compatible providers with their default base URLs.
 * All use the OpenAI chat completions API format.
 * Note: doubao is listed here for UI reference (label, models) but has its own provider.
 */
const OPENAI_COMPATIBLE_PROVIDERS = {
    deepseek: { baseUrl: 'https://api.deepseek.com/v1', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-pro', 'deepseek-v4-flash'], note: 'deepseek-v4-pro (V4旗舰), deepseek-v4-flash (V4快速), deepseek-chat (V3), deepseek-reasoner (R1, 推理, 不支持工具)' },
    baidu: { baseUrl: 'https://qianfan.baidubce.com/v2', label: '百度千帆' },
    tencent: { baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', label: '腾讯混元' },
    kimi: { baseUrl: 'https://api.moonshot.cn/v1', label: 'Kimi (Moonshot)', models: ['kimi-k2.6', 'moonshot-v1'] },
    qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', label: '通义千问', models: ['qwen3.6-plus', 'qwen3.6:27b', 'qwen-plus'] },
    doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', label: '豆包', models: ['doubao-seed-2-0-pro-260215'], note: 'doubao-seed-2-0-pro (旗舰, Responses API)' },
    glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', label: '智谱 GLM', models: ['glm-5.1', 'glm-4'] },
    minimax: { baseUrl: 'https://api.minimax.chat/v1', label: 'MiniMax', models: ['minimax-m2.7', 'minimax-m1'] },
    jinmo: { baseUrl: 'https://www.spiritrealmz.com/v1', label: '浙江金默', models: ['qwen3.6:27b'] },
    gemma: { baseUrl: 'https://www.spiritrealmz.com/v1', label: 'Gemma', models: ['gemma4:31b'] },
    qwen35b: { baseUrl: 'https://www.spiritrealmz.com/v1', label: 'Qwen3.6-35B Q4', models: ['batiai/qwen3.6-35b:q4'] },
};
/**
 * Parse model string like "openai:gpt-4o" or "deepseek:deepseek-chat"
 * If no provider prefix, defaults to openai.
 */
function parseModelString(model) {
    const colonIdx = model.indexOf(':');
    if (colonIdx === -1) {
        return { provider: 'openai', modelName: model };
    }
    return {
        provider: model.slice(0, colonIdx),
        modelName: model.slice(colonIdx + 1),
    };
}
export { OPENAI_COMPATIBLE_PROVIDERS };
/**
 * Known context window sizes for various models (in tokens).
 * Used to automatically set maxContextTokens based on the selected model.
 */
const MODEL_CONTEXT_WINDOWS = {
    // DeepSeek V4 - 1M context
    'deepseek-v4-pro': 1000000,
    'deepseek-v4-flash': 1000000,
    // DeepSeek V3 - 128K context
    'deepseek-chat': 128000,
    'deepseek-reasoner': 128000,
    // OpenAI
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'o1': 200000,
    'o1-mini': 128000,
    'o3': 200000,
    'o3-mini': 200000,
    'o4-mini': 200000,
    // Anthropic
    'claude-sonnet-4-20250514': 200000,
    'claude-3.5-sonnet': 200000,
    'claude-3-opus': 200000,
    // Kimi
    'kimi-k2.6': 128000,
    'moonshot-v1': 128000,
    // Qwen
    'qwen3.6-plus': 128000,
    // GLM
    'glm-5.1': 128000,
    'glm-4': 128000,
    // Doubao
    'doubao-seed-2-0-pro-260215': 128000,
};
/**
 * Get the context window size for a given model string (e.g. "deepseek:deepseek-v4-pro").
 * Returns the model's known context window, or the provided default.
 */
export function getModelContextWindow(model, defaultSize = 128000) {
    const { modelName } = parseModelString(model);
    return MODEL_CONTEXT_WINDOWS[modelName] ?? defaultSize;
}
export function createProvider(config) {
    const { provider, modelName } = parseModelString(config.model);
    switch (provider) {
        case 'openai': {
            const apiKey = config.apiKeys.openai?.trim();
            if (!apiKey) {
                throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable or add it to ~/.lingjing/config.json');
            }
            return new OpenAIProvider({ model: modelName, apiKey });
        }
        case 'anthropic': {
            const apiKey = config.apiKeys.anthropic?.trim();
            if (!apiKey) {
                throw new Error('Anthropic API key not found. Set ANTHROPIC_API_KEY environment variable or add it to ~/.lingjing/config.json');
            }
            return new AnthropicProvider({ model: modelName, apiKey });
        }
        case 'ollama':
            return new OllamaProvider({
                model: modelName,
                baseUrl: config.ollama.baseUrl,
            });
        case 'gemma': {
            // Use Ollama native API for gemma (better tool calling support)
            const gemmaApiKey = config.apiKeys['gemma']?.trim();
            return new OllamaProvider({
                model: modelName || 'gemma4:31b',
                baseUrl: 'https://www.spiritrealmz.com',
                apiKey: gemmaApiKey || undefined,
            });
        }
        case 'doubao': {
            const apiKey = config.apiKeys['doubao']?.trim();
            if (!apiKey) {
                throw new Error('豆包 API Key 未配置。请在设置 -> 模型中添加。');
            }
            return new DoubaoProvider({
                model: modelName,
                apiKey,
            });
        }
        case 'custom': {
            const custom = config.custom;
            if (!custom?.baseUrl) {
                throw new Error('自定义 API 的 Base URL 未配置。请在设置 -> 模型中设置。');
            }
            return new OpenAIProvider({
                model: modelName,
                apiKey: (custom.apiKey || '').trim(),
                baseUrl: custom.baseUrl,
            });
        }
        default: {
            // Check if it's an OpenAI-compatible Chinese provider
            const compatProvider = OPENAI_COMPATIBLE_PROVIDERS[provider];
            if (compatProvider) {
                const apiKey = config.apiKeys[provider]?.trim();
                if (!apiKey) {
                    throw new Error(`${compatProvider.label} API Key 未配置。请在设置 -> 模型中添加。`);
                }
                return new OpenAIProvider({
                    model: modelName,
                    apiKey,
                    baseUrl: compatProvider.baseUrl,
                });
            }
            throw new Error(`未知的提供商: ${provider}. 可用: openai, anthropic, ollama, deepseek, baidu, tencent, kimi, qwen, doubao, glm, minimax, jinmo, gemma, qwen35b, custom`);
        }
    }
}
//# sourceMappingURL=provider-factory.js.map