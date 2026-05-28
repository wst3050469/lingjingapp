"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookRegistry = void 0;
const logger_js_1 = require("../../utils/logger.js");
const DEFAULT_TIMEOUT = 100;
function generateHookId() {
    return `hook_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('hook timeout')), ms)),
    ]);
}
class HookRegistry {
    hooks = new Map();
    hookById = new Map();
    register(point, callback, options) {
        const id = generateHookId();
        const entry = {
            id,
            point,
            callback: callback,
            options: {
                priority: options?.priority ?? 0,
                mode: options?.mode ?? 'sync',
                timeout: options?.timeout ?? DEFAULT_TIMEOUT,
            },
        };
        this.hookById.set(id, entry);
        if (!this.hooks.has(point)) {
            this.hooks.set(point, []);
        }
        const list = this.hooks.get(point);
        list.push(entry);
        list.sort((a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0));
        return id;
    }
    unregister(id) {
        const entry = this.hookById.get(id);
        if (!entry)
            return false;
        const list = this.hooks.get(entry.point);
        if (list) {
            const idx = list.findIndex((e) => e.id === id);
            if (idx >= 0) {
                list.splice(idx, 1);
            }
            if (list.length === 0) {
                this.hooks.delete(entry.point);
            }
        }
        this.hookById.delete(id);
        return true;
    }
    async execute(point, data) {
        const context = {
            point,
            data,
            original: Object.freeze(structuredClone(data) ?? data),
        };
        const entries = this.hooks.get(point);
        if (!entries || entries.length === 0) {
            return context;
        }
        let current = context;
        for (const entry of entries) {
            try {
                const timeout = entry.options.timeout ?? DEFAULT_TIMEOUT;
                if (entry.options.mode === 'async') {
                    const result = await withTimeout(Promise.resolve(entry.callback(current)), timeout);
                    current = result;
                }
                else {
                    const result = await withTimeout(Promise.resolve(entry.callback(current)), timeout);
                    current = result;
                }
            }
            catch (err) {
                logger_js_1.logger.warn(`[HookRegistry] hook "${entry.id}" at "${point}" failed: ${err.message}`);
            }
        }
        return current;
    }
    healthCheck() {
        return {
            healthy: true,
            hookCount: this.hookById.size,
        };
    }
}
exports.HookRegistry = HookRegistry;
//# sourceMappingURL=hook-registry.js.map