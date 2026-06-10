import { logger } from '../utils/logger.js';
export class StorageGC {
    backend;
    maxStorageMB;
    checkIntervalMs;
    timer = null;
    constructor(backend, maxStorageMB = 500, checkIntervalMs = 300000) {
        this.backend = backend;
        this.maxStorageMB = maxStorageMB;
        this.checkIntervalMs = checkIntervalMs;
    }
    async checkAndCleanup() {
        const keys = await this.backend.list();
        let totalSize = 0;
        const sizes = [];
        for (const key of keys) {
            const data = await this.backend.load(key);
            if (data) {
                const size = JSON.stringify(data).length;
                const createdAt = data.createdAt ?? 0;
                totalSize += size;
                sizes.push({ key, size, createdAt });
            }
        }
        const maxBytes = this.maxStorageMB * 1024 * 1024;
        if (totalSize <= maxBytes)
            return 0;
        sizes.sort((a, b) => a.createdAt - b.createdAt);
        let cleanedBytes = 0;
        for (const item of sizes) {
            if (totalSize - cleanedBytes <= maxBytes * 0.8)
                break;
            await this.backend.delete(item.key);
            cleanedBytes += item.size;
            logger.info(`StorageGC: Cleaned ${item.key}, freed ${item.size} bytes`);
        }
        return cleanedBytes;
    }
    startAutoCheck() {
        if (this.timer)
            return;
        this.timer = setInterval(() => {
            this.checkAndCleanup().catch((err) => {
                logger.error('StorageGC: auto check failed:', err instanceof Error ? err.message : String(err));
            });
        }, this.checkIntervalMs);
    }
    stopAutoCheck() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}
//# sourceMappingURL=storage-gc.js.map