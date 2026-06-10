import { logger } from '../../utils/logger.js';
export class ChainedStorageBackend {
    type = 'memory';
    backends;
    activeIndex = 0;
    constructor(backends) {
        if (backends.length === 0)
            throw new Error('ChainedStorageBackend requires at least one backend');
        this.backends = backends;
        this.activeIndex = 0;
    }
    async save(key, data) {
        for (let i = this.activeIndex; i < this.backends.length; i++) {
            try {
                await this.backends[i].save(key, data);
                if (i !== this.activeIndex) {
                    logger.warn(`ChainedStorageBackend: Degraded from ${this.backends[this.activeIndex].type} to ${this.backends[i].type} for save`);
                    this.activeIndex = i;
                }
                return;
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                logger.warn(`ChainedStorageBackend: ${this.backends[i].type} save failed: ${errMsg}`);
            }
        }
        throw new Error('ChainedStorageBackend: All backends failed for save');
    }
    async load(key) {
        for (let i = this.activeIndex; i < this.backends.length; i++) {
            try {
                const data = await this.backends[i].load(key);
                if (data !== null)
                    return data;
            }
            catch (error) {
                logger.warn(`ChainedStorageBackend: ${this.backends[i].type} load failed`);
            }
        }
        for (let i = 0; i < this.activeIndex; i++) {
            try {
                const data = await this.backends[i].load(key);
                if (data !== null)
                    return data;
            }
            catch {
                // continue
            }
        }
        return null;
    }
    async delete(key) {
        try {
            return await this.backends[this.activeIndex].delete(key);
        }
        catch {
            return false;
        }
    }
    async list() {
        try {
            return await this.backends[this.activeIndex].list();
        }
        catch {
            return [];
        }
    }
    async exists(key) {
        try {
            return await this.backends[this.activeIndex].exists(key);
        }
        catch {
            return false;
        }
    }
    getActiveBackendType() {
        return this.backends[this.activeIndex].type;
    }
    getActiveIndex() {
        return this.activeIndex;
    }
}
//# sourceMappingURL=chained-backend.js.map