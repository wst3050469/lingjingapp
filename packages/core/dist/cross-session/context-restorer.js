import { ContextCompressor } from '../agent/context-compressor.js';
import { verifyChecksum } from './utils.js';
export class ContextRestorer {
    backend;
    versionManager;
    compressor;
    constructor(config) {
        this.backend = config.backend;
        this.versionManager = config.versionManager;
        this.compressor = config.compressor ?? new ContextCompressor();
    }
    async restore(sessionId, strategy = 'summary', options) {
        const raw = await this.backend.load(sessionId);
        if (!raw) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        let snapshot = raw;
        const warnings = [];
        let wasMigrated = false;
        let originalVersion;
        // Verify checksum
        const savedChecksum = snapshot.checksum;
        snapshot.checksum = '';
        if (savedChecksum && !verifyChecksum(snapshot, savedChecksum)) {
            warnings.push('Checksum verification failed - data may be corrupted');
        }
        snapshot.checksum = savedChecksum;
        // Version compatibility check
        const compat = this.versionManager.detectVersion(snapshot.snapshotVersion);
        if (compat.requiresMigration) {
            originalVersion = snapshot.snapshotVersion;
            try {
                const migrated = await this.versionManager.migrate(snapshot, snapshot.snapshotVersion);
                snapshot = migrated;
                wasMigrated = true;
                warnings.push(`Migrated from ${originalVersion} to ${compat.toVersion}`);
            }
            catch (error) {
                warnings.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        // Apply restore strategy
        const maxTokens = options?.maxContextTokens ?? 200000;
        const workingWindowSize = options?.workingWindowSize ?? 20;
        let messages = this.extractMessages(snapshot, strategy, workingWindowSize);
        let taskState = strategy === 'summary' ? undefined : snapshot.taskState;
        let toolCallHistory = strategy === 'summary' ? [] : snapshot.toolCallHistory;
        if (strategy === 'selective' && options?.categories) {
            if (!options.categories.includes('taskState'))
                taskState = undefined;
            if (!options.categories.includes('toolCallHistory'))
                toolCallHistory = [];
        }
        // Adaptive context window trimming
        const estimateTokens = (msgs) => msgs.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length / 4 : 100), 0);
        let totalTokens = estimateTokens(messages);
        if (totalTokens > maxTokens) {
            messages = this.compressor.compress(messages, estimateTokens);
            totalTokens = estimateTokens(messages);
        }
        if (totalTokens > maxTokens && strategy !== 'summary') {
            // Force downgrade to summary
            messages = this.extractMessages(snapshot, 'summary', workingWindowSize);
            warnings.push('Context exceeded window, downgraded to summary restore');
        }
        return {
            sessionId: snapshot.sessionId,
            messages,
            taskState,
            toolCallHistory,
            compactionSummary: snapshot.compactionSummary,
            wasMigrated,
            originalVersion,
            warnings,
        };
    }
    async autoRestore() {
        try {
            const keys = await this.backend.list();
            for (const key of keys) {
                const data = await this.backend.load(key);
                if (data) {
                    const snapshot = data;
                    if (snapshot.status === 'interrupted') {
                        return this.restore(key, 'summary');
                    }
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async resolveRefs(snapshot) {
        const missingRefs = [];
        const resolvedCheckpoints = [];
        const resolvedMemories = [];
        for (const ref of snapshot.checkpointRefs) {
            try {
                const data = await this.backend.load(ref);
                if (data) {
                    resolvedCheckpoints.push({ ref, data });
                }
                else {
                    missingRefs.push(ref);
                }
            }
            catch {
                missingRefs.push(ref);
            }
        }
        for (const ref of snapshot.memoryRefs) {
            try {
                const data = await this.backend.load(ref);
                if (data) {
                    resolvedMemories.push({ ref, content: JSON.stringify(data) });
                }
                else {
                    missingRefs.push(ref);
                }
            }
            catch {
                missingRefs.push(ref);
            }
        }
        return {
            ...snapshot,
            resolvedCheckpoints,
            resolvedMemories,
            missingRefs,
        };
    }
    extractMessages(snapshot, strategy, workingWindowSize) {
        switch (strategy) {
            case 'full':
                return [
                    ...snapshot.layers.system,
                    ...snapshot.layers.history,
                    ...snapshot.layers.working,
                ];
            case 'summary': {
                const system = snapshot.layers.system;
                const working = snapshot.layers.working.slice(-workingWindowSize);
                return [...system, ...working];
            }
            case 'selective':
                return [
                    ...snapshot.layers.system,
                    ...snapshot.layers.working,
                ];
            default:
                return [...snapshot.layers.system, ...snapshot.layers.working];
        }
    }
}
//# sourceMappingURL=context-restorer.js.map