"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolAdapter = void 0;
exports.createToolAdapter = createToolAdapter;
const logger_js_1 = require("../../utils/logger.js");
class ToolAdapter {
    version = '1.0.0';
    registry = null;
    setRegistry(registry) {
        this.registry = registry;
        logger_js_1.logger.info(`[ToolAdapter] registry set, size: ${registry.size}`);
    }
    register(tool, mcpServerName) {
        if (this.registry) {
            this.registry.register(tool, mcpServerName);
        }
        else {
            logger_js_1.logger.warn('[ToolAdapter] no registry configured, register ignored');
        }
    }
    get(name) {
        return this.registry?.get(name);
    }
    has(name) {
        return this.registry?.has(name) ?? false;
    }
    getAll() {
        return this.registry?.getAll() ?? [];
    }
}
exports.ToolAdapter = ToolAdapter;
function createToolAdapter(registry) {
    const adapter = new ToolAdapter();
    if (registry) {
        adapter.setRegistry(registry);
    }
    return adapter;
}
//# sourceMappingURL=tool-adapter.js.map