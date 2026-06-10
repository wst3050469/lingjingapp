import { ILLMAdapter, LLMProvider, ChatRequest, StreamEvent } from './types.js';
import { logger } from '../../utils/logger.js';

export class LLMAdapter implements ILLMAdapter {
  readonly version = '1.0.0';
  private provider: LLMProvider | null = null;

  setProvider(provider: LLMProvider): void {
    this.provider = provider;
    logger.info(`[LLMAdapter] provider set: ${provider.name}/${provider.model}`);
  }

  chat(request: ChatRequest): AsyncIterable<StreamEvent> {
    if (!this.provider) {
      throw new Error('[LLMAdapter] no LLMProvider configured');
    }
    return this.provider.chat(request);
  }

  getModel(): string {
    return this.provider?.model ?? '';
  }

  getName(): string {
    return this.provider?.name ?? '';
  }
}

export function createLLMAdapter(provider?: LLMProvider): LLMAdapter {
  const adapter = new LLMAdapter();
  if (provider) {
    adapter.setProvider(provider);
  }
  return adapter;
}
