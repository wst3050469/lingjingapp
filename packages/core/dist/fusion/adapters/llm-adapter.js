import { logger } from '../../utils/logger.js';
export class LLMAdapter {
    version = '1.0.0';
    provider = null;
    setProvider(provider) {
        this.provider = provider;
        logger.info(`[LLMAdapter] provider set: ${provider.name}/${provider.model}`);
    }
    chat(request) {
        if (!this.provider) {
            throw new Error('[LLMAdapter] no LLMProvider configured');
        }
        return this.provider.chat(request);
    }
    getModel() {
        return this.provider?.model ?? '';
    }
    getName() {
        return this.provider?.name ?? '';
    }
}
export function createLLMAdapter(provider) {
    const adapter = new LLMAdapter();
    if (provider) {
        adapter.setProvider(provider);
    }
    return adapter;
}
//# sourceMappingURL=llm-adapter.js.map