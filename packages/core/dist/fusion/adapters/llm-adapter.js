"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMAdapter = void 0;
exports.createLLMAdapter = createLLMAdapter;
const logger_js_1 = require("../../utils/logger.js");
class LLMAdapter {
    version = '1.0.0';
    provider = null;
    setProvider(provider) {
        this.provider = provider;
        logger_js_1.logger.info(`[LLMAdapter] provider set: ${provider.name}/${provider.model}`);
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
exports.LLMAdapter = LLMAdapter;
function createLLMAdapter(provider) {
    const adapter = new LLMAdapter();
    if (provider) {
        adapter.setProvider(provider);
    }
    return adapter;
}
//# sourceMappingURL=llm-adapter.js.map