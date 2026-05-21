import { describe, it, expect, vi, beforeEach } from 'vitest';
// ── Utils Tests ──
import { computeChecksum, verifyChecksum, generateSnapshotId, generateIncrementalId, } from '../utils.js';
describe('cross-session/utils', () => {
    describe('computeChecksum', () => {
        it('should generate deterministic SHA-256 hash', () => {
            var a = computeChecksum({ a: 1, b: 2 });
            var b = computeChecksum({ a: 1, b: 2 });
            expect(a).toBe(b);
        });
        it('should generate different hashes for different data', () => {
            var a = computeChecksum({ a: 1 });
            var b = computeChecksum({ a: 2 });
            expect(a).not.toBe(b);
        });
        it('should handle empty objects', () => {
            var hash = computeChecksum({});
            expect(hash).toBeTruthy();
            expect(hash.length).toBe(64); // SHA-256 hex
        });
    });
    describe('verifyChecksum', () => {
        it('should return true for matching checksum', () => {
            var data = { test: 'hello' };
            var hash = computeChecksum(data);
            expect(verifyChecksum(data, hash)).toBe(true);
        });
        it('should return false for mismatched checksum', () => {
            var data = { test: 'hello' };
            var hash = computeChecksum({ test: 'world' });
            expect(verifyChecksum(data, hash)).toBe(false);
        });
    });
    describe('generateSnapshotId', () => {
        it('should generate unique IDs', () => {
            var a = generateSnapshotId();
            var b = generateSnapshotId();
            expect(a).not.toBe(b);
        });
        it('should start with ss_ prefix', () => {
            var id = generateSnapshotId();
            expect(id.startsWith('ss_')).toBe(true);
        });
    });
    describe('generateIncrementalId', () => {
        it('should generate unique IDs', () => {
            var a = generateIncrementalId();
            var b = generateIncrementalId();
            expect(a).not.toBe(b);
        });
        it('should start with is_ prefix', () => {
            var id = generateIncrementalId();
            expect(id.startsWith('is_')).toBe(true);
        });
    });
});
// ── MemoryStorageBackend Tests ──
import { MemoryStorageBackend } from '../backends/memory-backend.js';
describe('MemoryStorageBackend', () => {
    var backend;
    beforeEach(() => {
        backend = new MemoryStorageBackend();
    });
    it('should save and load data', async () => {
        await backend.save('key1', { data: 'hello' });
        var result = await backend.load('key1');
        expect(result).toEqual({ data: 'hello' });
    });
    it('should return null for missing key', async () => {
        var result = await backend.load('nonexistent');
        expect(result).toBeNull();
    });
    it('should delete existing key', async () => {
        await backend.save('key1', 'value');
        var deleted = await backend.delete('key1');
        expect(deleted).toBe(true);
        var result = await backend.load('key1');
        expect(result).toBeNull();
    });
    it('should return false when deleting nonexistent key', async () => {
        var deleted = await backend.delete('nonexistent');
        expect(deleted).toBe(false);
    });
    it('should list all keys', async () => {
        await backend.save('a', 1);
        await backend.save('b', 2);
        await backend.save('c', 3);
        var keys = await backend.list();
        expect(keys.sort()).toEqual(['a', 'b', 'c']);
    });
    it('should check key existence', async () => {
        await backend.save('exists', 'value');
        expect(await backend.exists('exists')).toBe(true);
        expect(await backend.exists('missing')).toBe(false);
    });
    it('should clear all data', async () => {
        await backend.save('a', 1);
        await backend.save('b', 2);
        backend.clear();
        expect(backend.size).toBe(0);
        expect(await backend.list()).toEqual([]);
    });
    it('should report correct size', () => {
        expect(backend.size).toBe(0);
        backend.save('a', 1);
        expect(backend.size).toBe(1);
    });
    it('should have type field', () => {
        expect(backend.type).toBe('memory');
    });
});
// ── ChainedStorageBackend Tests ──
import { ChainedStorageBackend } from '../backends/chained-backend.js';
describe('ChainedStorageBackend', () => {
    it('should throw if constructed with empty backends', () => {
        expect(() => new ChainedStorageBackend([])).toThrow();
    });
    it('should save to primary backend', async () => {
        var primary = new MemoryStorageBackend();
        var chain = new ChainedStorageBackend([primary]);
        await chain.save('key', 'value');
        expect(await primary.load('key')).toBe('value');
    });
    it('should failover to secondary when primary save fails', async () => {
        var failer = { type: 'memory', save: vi.fn().mockRejectedValue(new Error('fail')), load: vi.fn(), delete: vi.fn(), list: vi.fn().mockResolvedValue([]), exists: vi.fn() };
        var secondary = new MemoryStorageBackend();
        var chain = new ChainedStorageBackend([failer, secondary]);
        await chain.save('key', 'data');
        expect(await secondary.load('key')).toBe('data');
        expect(chain.getActiveBackendType()).toBe('memory');
    });
    it('should load from any backend', async () => {
        var primary = new MemoryStorageBackend();
        var secondary = new MemoryStorageBackend();
        await secondary.save('key', 'found');
        var chain = new ChainedStorageBackend([primary, secondary]);
        var result = await chain.load('key');
        expect(result).toBe('found');
    });
    it('should return null when key not found in any backend', async () => {
        var chain = new ChainedStorageBackend([new MemoryStorageBackend()]);
        expect(await chain.load('missing')).toBeNull();
    });
    it('should throw when all backends fail to save', async () => {
        var failer1 = { type: 'memory', save: vi.fn().mockRejectedValue(new Error('fail1')), load: vi.fn(), delete: vi.fn(), list: vi.fn().mockResolvedValue([]), exists: vi.fn() };
        var failer2 = { type: 'memory', save: vi.fn().mockRejectedValue(new Error('fail2')), load: vi.fn(), delete: vi.fn(), list: vi.fn().mockResolvedValue([]), exists: vi.fn() };
        var chain = new ChainedStorageBackend([failer1, failer2]);
        await expect(chain.save('key', 'val')).rejects.toThrow();
    });
});
// ── MigrationPipeline Tests ──
import { MigrationPipeline } from '../migration-pipeline.js';
describe('MigrationPipeline', () => {
    var pipeline;
    beforeEach(() => {
        pipeline = new MigrationPipeline();
    });
    it('should register and execute migration steps', async () => {
        pipeline.register({
            fromVersion: '1.0.0',
            toVersion: '2.0.0',
            transform: (data) => ({ ...data, migrated: true }),
        });
        var result = await pipeline.execute({ old: 'data' }, '1.0.0', '2.0.0');
        expect(result).toEqual({ old: 'data', migrated: true });
    });
    it('should chain multiple steps', async () => {
        pipeline.register({
            fromVersion: '1.0.0',
            toVersion: '1.1.0',
            transform: (data) => ({ ...data, step1: true }),
        });
        pipeline.register({
            fromVersion: '1.1.0',
            toVersion: '2.0.0',
            transform: (data) => ({ ...data, step2: true }),
        });
        var result = await pipeline.execute({}, '1.0.0', '2.0.0');
        expect(result).toEqual({ step1: true, step2: true });
    });
    it('should throw on missing migration path', async () => {
        await expect(pipeline.execute({}, '1.0.0', '2.0.0')).rejects.toThrow();
    });
    it('should execute direct step when available', async () => {
        var directTransform = vi.fn((data) => ({ ...data, direct: true }));
        pipeline.register({ fromVersion: '1.0.0', toVersion: '3.0.0', transform: directTransform });
        var result = await pipeline.execute({}, '1.0.0', '3.0.0');
        expect(directTransform).toHaveBeenCalled();
        expect(result).toEqual({ direct: true });
    });
    it('should rollback on transform failure', async () => {
        var rollbackFn = vi.fn((data) => ({ ...data, rolledBack: true }));
        pipeline.register({
            fromVersion: '1.0.0',
            toVersion: '2.0.0',
            transform: () => { throw new Error('transform failed'); },
            rollback: rollbackFn,
        });
        await expect(pipeline.execute({ old: 'data' }, '1.0.0', '2.0.0')).rejects.toThrow();
    });
    it('should list registered steps', () => {
        pipeline.register({ fromVersion: '1.0.0', toVersion: '2.0.0', transform: (d) => d });
        pipeline.register({ fromVersion: '2.0.0', toVersion: '3.0.0', transform: (d) => d });
        expect(pipeline.getRegisteredSteps()).toEqual(['1.0.0->2.0.0', '2.0.0->3.0.0']);
    });
    it('should check if step exists', () => {
        pipeline.register({ fromVersion: '1.0.0', toVersion: '2.0.0', transform: (d) => d });
        expect(pipeline.hasStep('1.0.0', '2.0.0')).toBe(true);
        expect(pipeline.hasStep('2.0.0', '3.0.0')).toBe(false);
    });
});
// ── IncrementalSnapshotter Tests ──
import { IncrementalSnapshotter } from '../incremental-snapshotter.js';
describe('IncrementalSnapshotter', () => {
    var snapshotter;
    var mockConversation;
    beforeEach(() => {
        snapshotter = new IncrementalSnapshotter();
        mockConversation = { messages: [] };
    });
    it('should return null when no base snapshot', () => {
        expect(snapshotter.computeDelta(mockConversation, null)).toBeNull();
    });
    it('should return null when no changes', () => {
        var baseSnapshot = {
            snapshotId: 'ss_abc',
            layers: { system: [], history: [], working: [] },
            toolCallHistory: [],
        };
        expect(snapshotter.computeDelta(mockConversation, baseSnapshot)).toBeNull();
    });
    it('should detect added messages', () => {
        var baseSnapshot = {
            snapshotId: 'ss_abc',
            layers: { system: [], history: [], working: [{ role: 'user', content: 'hi' }] },
            toolCallHistory: [],
        };
        mockConversation.messages = [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
        ];
        var delta = snapshotter.computeDelta(mockConversation, baseSnapshot);
        expect(delta).not.toBeNull();
        expect(delta?.deltas.addedMessages).toHaveLength(1);
        expect(delta?.deltas.addedMessages?.[0]).toEqual({ role: 'assistant', content: 'hello' });
    });
    it('should generate incrementalId starting with is_', () => {
        var baseSnapshot = {
            snapshotId: 'ss_abc',
            layers: { system: [], history: [], working: [] },
            toolCallHistory: [],
        };
        mockConversation.messages = [{ role: 'user', content: 'new' }];
        var delta = snapshotter.computeDelta(mockConversation, baseSnapshot);
        expect(delta?.incrementalId.startsWith('is_')).toBe(true);
    });
    it('should save incremental snapshot to backend', async () => {
        var backend = new MemoryStorageBackend();
        var incremental = {
            incrementalId: 'is_test',
            baseSnapshotId: 'ss_test',
            deltas: { addedMessages: [{ role: 'user', content: 'test' }] },
            createdAt: Date.now(),
            checksum: 'abc',
        };
        var result = await snapshotter.saveIncremental(incremental, backend);
        expect(result.success).toBe(true);
        expect(result.snapshotId).toBe('is_test');
        expect(await backend.load('is_test')).toEqual(incremental);
    });
    it('should manage base snapshot ID', () => {
        expect(snapshotter.getBaseSnapshotId()).toBeNull();
        snapshotter.setBaseSnapshot('ss_xxx');
        expect(snapshotter.getBaseSnapshotId()).toBe('ss_xxx');
    });
});
// ── StorageGC Tests ──
import { StorageGC } from '../storage-gc.js';
describe('StorageGC', () => {
    it('should not clean when under capacity', async () => {
        var backend = new MemoryStorageBackend();
        await backend.save('small', { createdAt: Date.now(), data: 'x' });
        var gc = new StorageGC(backend, 500); // 500MB limit
        var cleaned = await gc.checkAndCleanup();
        expect(cleaned).toBe(0);
    });
    it('should clean oldest items when over capacity', async () => {
        var backend = new MemoryStorageBackend();
        await backend.save('old', { createdAt: 100, data: 'x'.repeat(1000) });
        await backend.save('new', { createdAt: 200, data: 'y'.repeat(1000) });
        // Set maxStorageMB very low so we're always over capacity
        var gc = new StorageGC(backend, 0.001); // ~1KB limit
        var cleaned = await gc.checkAndCleanup();
        expect(cleaned).toBeGreaterThan(0);
        expect(await backend.exists('old')).toBe(false);
    });
    it('should stop and start auto check', () => {
        var gc = new StorageGC(new MemoryStorageBackend(), 500);
        gc.startAutoCheck();
        gc.stopAutoCheck();
        // Just verify no errors thrown
        expect(true).toBe(true);
    });
});
// ── SchemaVersionManager Tests ──
import { SchemaVersionManager } from '../schema-version-manager.js';
describe('SchemaVersionManager', () => {
    var manager;
    var pipeline;
    beforeEach(() => {
        pipeline = new MigrationPipeline();
        manager = new SchemaVersionManager(pipeline);
    });
    it('should have default version', () => {
        expect(manager.currentVersion).toBe('2.0.0');
    });
    it('should detect version compatibility: same version', () => {
        var compat = manager.detectVersion('2.0.0');
        expect(compat.isCompatible).toBe(true);
        expect(compat.requiresMigration).toBe(false);
    });
    it('should detect need for migration on older version', () => {
        var compat = manager.detectVersion('1.0.0');
        expect(compat.requiresMigration).toBe(true);
        expect(compat.fromVersion).toBe('1.0.0');
        expect(compat.toVersion).toBe('2.0.0');
    });
    it('should stamp version onto data', () => {
        var data = manager.stampVersion({ existing: 'data' });
        expect(data.snapshotVersion).toBe('2.0.0');
        expect(data.existing).toBe('data');
    });
    it('should skip migration when already at target version', async () => {
        var result = await manager.migrate({ test: 'data' }, '2.0.0');
        expect(result).toEqual({ test: 'data' });
    });
    it('should execute migration pipeline for version upgrade', async () => {
        pipeline.register({
            fromVersion: '1.0.0',
            toVersion: '2.0.0',
            transform: (data) => ({ ...data, migrated: true }),
        });
        var result = await manager.migrate({ old: 'data' }, '1.0.0');
        expect(result).toEqual({ old: 'data', migrated: true });
    });
});
//# sourceMappingURL=cross-session.test.js.map