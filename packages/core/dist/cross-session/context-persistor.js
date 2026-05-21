import { DataSanitizer } from '../security/data-sanitizer.js';
import { ContextCompressor } from '../agent/context-compressor.js';
import { computeChecksum, generateSnapshotId } from './utils.js';
import { logger } from '../utils/logger.js';
export class ContextPersistor {
    backend;
    sanitizer;
    versionManager;
    compressor;
    queue;
    processing = false;
    maxQueueDepth;
    constructor(config) {
        this.backend = config.backend;
        this.sanitizer = config.sanitizer ?? new DataSanitizer();
        this.versionManager = config.versionManager;
        this.compressor = config.compressor ?? new ContextCompressor();
        this.queue = [];
        this.maxQueueDepth = config.maxQueueDepth ?? 100;
    }
    async save(snapshot) {
        return this.enqueue(async () => {
            const start = Date.now();
            try {
                const separated = this.compressor.separateLayers([
                    ...snapshot.layers.system,
                    ...snapshot.layers.history,
                    ...snapshot.layers.working,
                ]);
                const sanitizedSnapshot = {
                    ...snapshot,
                    snapshotVersion: this.versionManager.currentVersion,
                    layers: {
                        system: this.sanitizer.sanitize(separated.system),
                        working: this.sanitizer.sanitize(separated.working),
                        history: this.sanitizer.sanitize(separated.history),
                    },
                    compactionSummary: snapshot.compactionSummary
                        ? this.sanitizer.sanitize(snapshot.compactionSummary)
                        : undefined,
                    checksum: '',
                };
                sanitizedSnapshot.checksum = computeChecksum(sanitizedSnapshot);
                const jsonSize = JSON.stringify(sanitizedSnapshot).length;
                if (!sanitizedSnapshot.snapshotId) {
                    sanitizedSnapshot.snapshotId = generateSnapshotId();
                }
                await this.backend.save(sanitizedSnapshot.snapshotId, sanitizedSnapshot);
                return {
                    success: true,
                    snapshotId: sanitizedSnapshot.snapshotId,
                    sizeBytes: jsonSize,
                    durationMs: Date.now() - start,
                };
            }
            catch (error) {
                return {
                    success: false,
                    snapshotId: snapshot.snapshotId || generateSnapshotId(),
                    sizeBytes: 0,
                    durationMs: Date.now() - start,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }
    async load(sessionId) {
        try {
            const data = await this.backend.load(sessionId);
            if (!data)
                return null;
            return data;
        }
        catch (error) {
            logger.error(`ContextPersistor: Failed to load ${sessionId}:`, error instanceof Error ? error.message : String(error));
            return null;
        }
    }
    async list() {
        try {
            const keys = await this.backend.list();
            const metadata = [];
            for (const key of keys) {
                const data = await this.backend.load(key);
                if (data) {
                    const snapshot = data;
                    metadata.push({
                        sessionId: snapshot.sessionId,
                        snapshotId: snapshot.snapshotId,
                        createdAt: snapshot.createdAt,
                        status: snapshot.status,
                        workingDirectory: snapshot.workingDirectory,
                        modelProvider: snapshot.modelConfig?.provider ?? 'unknown',
                        messageCount: (snapshot.layers?.system?.length ?? 0) +
                            (snapshot.layers?.working?.length ?? 0) +
                            (snapshot.layers?.history?.length ?? 0),
                        lastActivityAt: snapshot.createdAt,
                    });
                }
            }
            return metadata.sort((a, b) => b.createdAt - a.createdAt);
        }
        catch {
            return [];
        }
    }
    async delete(sessionId) {
        await this.backend.delete(sessionId);
    }
    enqueue(fn) {
        if (this.queue.length >= this.maxQueueDepth) {
            return Promise.resolve({
                success: false,
                snapshotId: '',
                sizeBytes: 0,
                durationMs: 0,
                error: 'Queue depth exceeded',
            });
        }
        return new Promise((resolve, reject) => {
            this.queue.push({ resolve, reject, fn });
            this.processQueue();
        });
    }
    async processQueue() {
        if (this.processing)
            return;
        this.processing = true;
        while (this.queue.length > 0) {
            const item = this.queue.shift();
            try {
                const result = await item.fn();
                item.resolve(result);
            }
            catch (error) {
                item.reject(error instanceof Error ? error : new Error(String(error)));
            }
        }
        this.processing = false;
    }
}
//# sourceMappingURL=context-persistor.js.map