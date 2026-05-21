import { logger } from '../../utils/logger.js';
export class SkillAdapter {
    version = '1.0.0';
    skills = new Map();
    loadHandler = null;
    setLoadHandler(handler) {
        this.loadHandler = handler;
        logger.info('[SkillAdapter] load handler set');
    }
    async load(config) {
        this.skills.set(config.name, config);
        if (this.loadHandler) {
            try {
                await this.loadHandler(config);
            }
            catch (err) {
                logger.warn(`[SkillAdapter] load handler error for "${config.name}": ${err.message}`);
            }
        }
    }
    async unload(name) {
        this.skills.delete(name);
    }
    get(name) {
        return this.skills.get(name);
    }
    getAll() {
        return Array.from(this.skills.values());
    }
}
export function createSkillAdapter() {
    return new SkillAdapter();
}
//# sourceMappingURL=skill-adapter.js.map