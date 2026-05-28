"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryAdapter = void 0;
exports.createMemoryAdapter = createMemoryAdapter;
const logger_js_1 = require("../../utils/logger.js");
class MemoryAdapter {
    version = '1.0.0';
    store = new Map();
    writeHandler = null;
    setWriteHandler(handler) {
        this.writeHandler = handler;
        logger_js_1.logger.info('[MemoryAdapter] write handler set');
    }
    getScope(scope = 'default') {
        if (!this.store.has(scope)) {
            this.store.set(scope, new Map());
        }
        return this.store.get(scope);
    }
    async write(key, value, scope) {
        const s = this.getScope(scope);
        s.set(key, value);
        if (this.writeHandler) {
            try {
                await this.writeHandler(key, value, scope);
            }
            catch (err) {
                logger_js_1.logger.warn(`[MemoryAdapter] write handler error: ${err.message}`);
            }
        }
    }
    async read(key, scope) {
        const s = this.getScope(scope);
        return s.get(key);
    }
    async delete(key, scope) {
        const s = this.getScope(scope);
        s.delete(key);
    }
    async list(scope) {
        const s = this.getScope(scope);
        return Array.from(s.entries()).map(([key, value]) => ({ key, value }));
    }
}
exports.MemoryAdapter = MemoryAdapter;
function createMemoryAdapter() {
    return new MemoryAdapter();
}
//# sourceMappingURL=memory-adapter.js.map