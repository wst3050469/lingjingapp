// Provider factory and model context window mapping
// Used by config:get to determine maxContextTokens based on model name

/**
 * Known model context window sizes (tokens).
 * Returns the model-specific context window, or the default if the model is unknown.
 */
export function getModelContextWindow(model: string, defaultWindow: number): number {
  if (!model) return defaultWindow;

  const m = model.toLowerCase();

  // GPT-4 series
  if (m.includes('gpt-4o')) return 128000;
  if (m.includes('gpt-4-turbo')) return 128000;
  if (m.includes('gpt-4-32k')) return 32768;
  if (m.includes('gpt-4')) return 8192;
  if (m.includes('gpt-3.5-turbo-16k')) return 16385;
  if (m.includes('gpt-3.5')) return 16385;
  if (m.includes('o1-')) return 200000;
  if (m.includes('o3-')) return 200000;

  // Claude series
  if (m.includes('claude-3.5')) return 200000;
  if (m.includes('claude-3')) return 200000;
  if (m.includes('claude-2')) return 100000;
  if (m.includes('claude')) return 200000;

  // DeepSeek series
  if (m.includes('deepseek-r1')) return 128000;
  if (m.includes('deepseek-v3')) return 128000;
  if (m.includes('deepseek-v2')) return 128000;
  if (m.includes('deepseek-coder')) return 128000;
  if (m.includes('deepseek-chat')) return 128000;
  if (m.includes('deepseek')) return 128000;

  // Qwen / Tongyi series
  if (m.includes('qwen-max')) return 32768;
  if (m.includes('qwen-plus')) return 131072;
  if (m.includes('qwen-turbo')) return 131072;
  if (m.includes('qwen2.5')) return 131072;
  if (m.includes('qwen2')) return 131072;
  if (m.includes('qwen')) return 32768;

  // GLM series
  if (m.includes('glm-4-plus')) return 128000;
  if (m.includes('glm-4')) return 128000;
  if (m.includes('glm-3')) return 128000;
  if (m.includes('glm')) return 128000;

  // Moonshot / Kimi
  if (m.includes('moonshot')) return 128000;
  if (m.includes('kimi')) return 128000;

  // Yi series
  if (m.includes('yi-large')) return 32768;
  if (m.includes('yi-')) return 32768;

  // ERNIE / Baidu
  if (m.includes('ernie-4')) return 8192;
  if (m.includes('ernie')) return 8192;

  // Gemini
  if (m.includes('gemini-2')) return 1048576;
  if (m.includes('gemini-1.5-pro')) return 2097152;
  if (m.includes('gemini-1.5-flash')) return 1048576;
  if (m.includes('gemini-pro')) return 32768;
  if (m.includes('gemini')) return 32768;

  // Llama / Meta
  if (m.includes('llama-3.1')) return 128000;
  if (m.includes('llama-3')) return 8192;
  if (m.includes('llama')) return 8192;

  // Mistral
  if (m.includes('mistral-large')) return 128000;
  if (m.includes('mistral-small')) return 32768;
  if (m.includes('mistral')) return 32768;
  if (m.includes('codestral')) return 32768;

  // MiniMax
  if (m.includes('abab6')) return 245760;
  if (m.includes('abab5')) return 245760;

  // Generic pattern matching
  if (m.includes('128k')) return 128000;
  if (m.includes('200k')) return 200000;
  if (m.includes('32k')) return 32768;
  if (m.includes('16k')) return 16385;
  if (m.includes('8k')) return 8192;
  if (m.includes('1m')) return 1048576;

  // Unknown model → return default
  return defaultWindow;
}

/**
 * Known OpenAI-compatible providers.
 * Maps provider names to their API base URLs.
 */
export const OPENAI_COMPATIBLE_PROVIDERS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
  ollama: 'http://localhost:11434/v1',
};

/**
 * Create an OpenAI-compatible LLM provider instance.
 * Simplified stub - the full implementation is in the OpenAIProvider class.
 */
export function createProvider(config: {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
}): Record<string, unknown> {
  return {
    name: config?.provider || 'openai',
    model: config?.model || 'gpt-4o',
    apiKey: config?.apiKey || '',
    baseURL: config?.baseURL || '',
  };
}
