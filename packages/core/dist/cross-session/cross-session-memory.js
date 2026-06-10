import { ContextPersistor } from './context-persistor.js';
import { ContextRestorer } from './context-restorer.js';
import { IncrementalSnapshotter } from './incremental-snapshotter.js';
import { SchemaVersionManager } from './schema-version-manager.js';
import { MigrationPipeline } from './migration-pipeline.js';
import { NudgerAdapter } from './adapters/nudger-adapter.js';
import { ReflectorAdapter } from './adapters/reflector-adapter.js';
import { ShutdownHook } from './adapters/shutdown-hook.js';
import { StorageGC } from './storage-gc.js';
import { DataSanitizer } from '../security/data-sanitizer.js';
export class CrossSessionMemory {
    persistor;
    restorer;
    snapshotter;
    versionManager;
    migrationPipeline;
    nudgerAdapter = null;
    reflectorAdapter = null;
    shutdownHook;
    gc;
    sanitizer;
    constructor(backend, config = {}, deps) {
        this.migrationPipeline = new MigrationPipeline();
        this.versionManager = new SchemaVersionManager(this.migrationPipeline);
        this.sanitizer = new DataSanitizer();
        this.snapshotter = new IncrementalSnapshotter();
        this.shutdownHook = new ShutdownHook();
        this.persistor = new ContextPersistor({
            backend,
            sanitizer: this.sanitizer,
            versionManager: this.versionManager,
            maxQueueDepth: config.maxQueueDepth,
        });
        this.restorer = new ContextRestorer({
            backend,
            versionManager: this.versionManager,
        });
        this.gc = new StorageGC(backend, config.maxStorageMB);
        if (deps?.nudger) {
            this.nudgerAdapter = new NudgerAdapter(deps.nudger, this.snapshotter, this.persistor);
        }
        if (deps?.reflector) {
            this.reflectorAdapter = new ReflectorAdapter(deps.reflector);
        }
        if (deps?.shutdown) {
            this.shutdownHook.register(deps.shutdown, this.persistor, () => null);
        }
    }
    async save(snapshot) {
        return this.persistor.save(snapshot);
    }
    async restore(sessionId, strategy, options) {
        return this.restorer.restore(sessionId, strategy, options);
    }
    async autoRestore() {
        return this.restorer.autoRestore();
    }
    async listSessions() {
        return this.persistor.list();
    }
    async deleteSession(sessionId) {
        return this.persistor.delete(sessionId);
    }
    onNudge(conversation, baseSnapshot) {
        this.nudgerAdapter?.onNudge(conversation, baseSnapshot);
    }
    onReflect(memories) {
        this.reflectorAdapter?.onReflect(memories);
    }
    consumeReflectorResult() {
        return this.reflectorAdapter?.consumeReflectorResult() ?? null;
    }
    getVersionManager() {
        return this.versionManager;
    }
    getMigrationPipeline() {
        return this.migrationPipeline;
    }
    getGC() {
        return this.gc;
    }
}
//# sourceMappingURL=cross-session-memory.js.map