import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileStorageBackend } from '../backends/file-backend.js';
import { MemoryStorageBackend } from '../backends/memory-backend.js';
import { SQLiteStorageBackend } from '../backends/sqlite-backend.js';
import { ContextPersistor } from '../context-persistor.js';
import { ContextRestorer } from '../context-restorer.js';
import { CrossSessionMemory } from '../cross-session-memory.js';
import { NudgerAdapter } from '../adapters/nudger-adapter.js';
import { ReflectorAdapter } from '../adapters/reflector-adapter.js';
import { ShutdownHook } from '../adapters/shutdown-hook.js';
import { SchemaVersionManager } from '../schema-version-manager.js';
import { MigrationPipeline } from '../migration-pipeline.js';
import { IncrementalSnapshotter } from '../incremental-snapshotter.js';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
// ���� FileStorageBackend Tests ����
describe('FileStorageBackend', () => {
    let fixtureDir;
    let backend;
    beforeEach(() => {
        fixtureDir = join(tmpdir(), 'csm-test-' + Math.random().toString(36).slice(2));
        mkdirSync(fixtureDir, { recursive: true });
        backend = new FileStorageBackend(fixtureDir);
    });
    afterEach(() => {
        try {
            rmSync(fixtureDir, { recursive: true, force: true });
        }
        catch { }
    });
    it('should have type field', () => { expect(backend.type).toBe('filesystem'); });
    it('should save and load data', async () => {
        await backend.save('key1', { hello: 'world' });
        expect(await backend.load('key1')).toEqual({ hello: 'world' });
    });
    it('should return null for missing key', async () => {
        expect(await backend.load('nonexistent')).toBeNull();
    });
    it('should delete existing key', async () => {
        await backend.save('key_del', 'value');
        expect(await backend.delete('key_del')).toBe(true);
        expect(await backend.load('key_del')).toBeNull();
    });
    it('should return false on delete of nonexistent', async () => {
        expect(await backend.delete('ghost')).toBe(false);
    });
    it('should list keys', async () => {
        await backend.save('a', 1);
        await backend.save('b', 2);
        const keys = await backend.list();
        expect(keys.sort()).toEqual(['a', 'b']);
    });
    it('should check existence', async () => {
        await backend.save('exists', 'x');
        expect(await backend.exists('exists')).toBe(true);
        expect(await backend.exists('missing')).toBe(false);
    });
    it('should return size for existing key', async () => {
        await backend.save('size_test', { data: 'hello' });
        expect(await backend.getSize('size_test')).toBeGreaterThan(0);
    });
    it('should return 0 for missing key', async () => {
        expect(await backend.getSize('no_key')).toBe(0);
    });
    it('should create dir on first save', async () => {
        const newDir = join(tmpdir(), 'csm-' + Math.random().toString(36).slice(2));
        const b2 = new FileStorageBackend(newDir);
        await b2.save('first', 'value');
        expect(existsSync(newDir)).toBe(true);
        try {
            rmSync(newDir, { recursive: true, force: true });
        }
        catch { }
    });
    it('should handle empty listing', async () => {
        expect(await backend.list()).toEqual([]);
    });
});
// ���� SQLiteStorageBackend Tests ����
describe('SQLiteStorageBackend', () => {
    let db;
    let backend;
    beforeEach(() => {
        const store = new Map();
        db = {
            exec: vi.fn(),
            run: vi.fn((sql, params) => {
                if (sql.includes('INSERT') || sql.includes('UPDATE')) {
                    const key = params?.[0] ?? '';
                    const data = params?.[4] ?? '';
                    store.set(key, data);
                }
                if (sql.includes('DELETE')) {
                    store.delete(params?.[0] ?? '');
                }
                return { changes: 1 };
            }),
            get: vi.fn((sql, params) => {
                if (sql.includes('WHERE snapshot_id = ?')) {
                    const key = params?.[0];
                    const raw = store.get(key);
                    return raw ? { data: raw } : undefined;
                }
                return undefined;
            }),
            all: vi.fn(() => Array.from(store.keys()).map(k => ({ snapshot_id: k }))),
        };
        backend = new SQLiteStorageBackend(db);
    });
    it('should have type field', () => { expect(backend.type).toBe('sqlite'); });
    it('should save and load', async () => {
        await backend.save('snap1', { sessionId: 's1', data: 'hello' });
        const result = await backend.load('snap1');
        expect(result).toEqual({ sessionId: 's1', data: 'hello' });
    });
    it('should return null for missing', async () => {
        expect(await backend.load('missing')).toBeNull();
    });
    it('should delete', async () => {
        await backend.save('to_del', { sessionId: 's2' });
        expect(await backend.delete('to_del')).toBe(true);
    });
    it('should list keys', async () => {
        await backend.save('k1', {});
        await backend.save('k2', {});
        const keys = await backend.list();
        expect(keys.sort()).toEqual(['k1', 'k2']);
    });
    it('should check existence', async () => {
        await backend.save('exist', {});
        expect(await backend.exists('exist')).toBe(true);
        expect(await backend.exists('missing')).toBe(false);
    });
    it('should init tables on first use', async () => {
        await backend.save('init_test', {});
        expect(db.exec).toHaveBeenCalled();
    });
});
// ���� ContextPersistor Tests ����
describe('ContextPersistor', () => {
    let backend;
    let persistor;
    function makeSnapshot(sessionId = 'session-1', extra = {}) {
        return {
            snapshotId: extra.snapshotId ?? '',
            snapshotVersion: '2.0.0',
            sessionId, createdAt: Date.now(), workingDirectory: '/test',
            modelConfig: { provider: 'test', model: 'gpt-4', temperature: 0, maxContextTokens: 1000, maxResponseTokens: 500 },
            status: 'active',
            layers: { system: [], working: [{ role: 'user', content: 'hi' }], history: [] },
            toolCallHistory: [], checkpointRefs: [], memoryRefs: [], metadata: {}, checksum: '',
            ...extra,
        };
    }
    beforeEach(() => {
        backend = new MemoryStorageBackend();
        persistor = new ContextPersistor({ backend, versionManager: new SchemaVersionManager(new MigrationPipeline()) });
    });
    it('should save and return success', async () => {
        const r = await persistor.save(makeSnapshot());
        expect(r.success).toBe(true);
        expect(r.snapshotId).toBeTruthy();
        expect(r.sizeBytes).toBeGreaterThan(0);
    });
    it('should load saved snapshot', async () => {
        const saved = await persistor.save(makeSnapshot());
        const loaded = await persistor.load(saved.snapshotId);
        expect(loaded).not.toBeNull();
        expect(loaded.sessionId).toBe('session-1');
    });
    it('should return null for missing session', async () => {
        expect(await persistor.load('no-such')).toBeNull();
    });
    it('should list sessions as metadata', async () => {
        await persistor.save(makeSnapshot());
        const list = await persistor.list();
        expect(list.length).toBe(1);
        expect(list[0].sessionId).toBe('session-1');
    });
    it('should delete a session', async () => {
        const saved = await persistor.save(makeSnapshot());
        await persistor.delete(saved.snapshotId);
        expect(await persistor.load(saved.snapshotId)).toBeNull();
    });
    it('should reject when queue depth exceeded', async () => {
        const sp = new ContextPersistor({ backend, versionManager: new SchemaVersionManager(new MigrationPipeline()), maxQueueDepth: 0 });
        const r = await sp.save(makeSnapshot());
        expect(r.success).toBe(false);
        expect(r.error).toContain('Queue');
    });
    it('should handle backend save error gracefully', async () => {
        const failBackend = { type: 'memory', save: vi.fn().mockRejectedValue(new Error('storage full')), load: vi.fn(), delete: vi.fn(), list: vi.fn().mockResolvedValue([]), exists: vi.fn() };
        const fp = new ContextPersistor({ backend: failBackend, versionManager: new SchemaVersionManager(new MigrationPipeline()) });
        const r = await fp.save(makeSnapshot());
        expect(r.success).toBe(false);
        expect(r.error).toBe('storage full');
    });
});
// ���� ContextRestorer Tests ����
describe('ContextRestorer', () => {
    let backend;
    let restorer;
    function makeSnapshot(extra = {}) {
        return {
            snapshotId: 'ss_test', snapshotVersion: '2.0.0', sessionId: 'session-restore',
            createdAt: Date.now(), workingDirectory: '/test',
            modelConfig: { provider: 'test', model: 'gpt-4', temperature: 0, maxContextTokens: 1000, maxResponseTokens: 500 },
            status: 'interrupted',
            layers: { system: [{ role: 'system', content: 'You are helper.' }], working: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello!' }], history: [{ role: 'user', content: 'Old msg' }] },
            toolCallHistory: [{ toolName: 'test', arguments: {}, resultSummary: 'ok', isError: false, durationMs: 10, timestamp: Date.now() }],
            checkpointRefs: [], memoryRefs: [], metadata: {}, checksum: '',
            ...extra,
        };
    }
    beforeEach(() => {
        backend = new MemoryStorageBackend();
        restorer = new ContextRestorer({ backend, versionManager: new SchemaVersionManager(new MigrationPipeline()) });
    });
    it('should throw for missing session', async () => {
        await expect(restorer.restore('no-session')).rejects.toThrow('Session');
    });
    it('should restore with full strategy (all layers)', async () => {
        await backend.save('ss_test', makeSnapshot());
        const ctx = await restorer.restore('ss_test', 'full');
        expect(ctx.messages.length).toBe(4);
        expect(ctx.toolCallHistory.length).toBe(1);
    });
    it('should restore with summary strategy', async () => {
        await backend.save('ss_test', makeSnapshot());
        const ctx = await restorer.restore('ss_test', 'summary');
        expect(ctx.messages.length).toBe(3);
        expect(ctx.toolCallHistory.length).toBe(0);
    });
    it('should restore with selective strategy', async () => {
        await backend.save('ss_test', makeSnapshot());
        const ctx = await restorer.restore('ss_test', 'selective');
        expect(ctx.messages.length).toBe(3);
    });
    it('should warn on checksum mismatch', async () => {
        await backend.save('ss_test', makeSnapshot({ checksum: 'invalid' }));
        const ctx = await restorer.restore('ss_test', 'summary');
        expect(ctx.warnings.some((w) => w.includes('Checksum'))).toBe(true);
    });
    it('should auto-restore interrupted session', async () => {
        await backend.save('ss_test', makeSnapshot());
        const r = await restorer.autoRestore();
        expect(r).not.toBeNull();
        expect(r.sessionId).toBe('session-restore');
    });
    it('should return null when no interrupted', async () => {
        await backend.save('ss_test', makeSnapshot({ status: 'completed' }));
        expect(await restorer.autoRestore()).toBeNull();
    });
    it('should resolve refs and find missing', async () => {
        const snap = makeSnapshot({ checkpointRefs: ['cp_1', 'cp_2'], memoryRefs: ['mem_1'] });
        await backend.save('cp_1', { data: 'ok' });
        const r = await restorer.resolveRefs(snap);
        expect(r.resolvedCheckpoints.length).toBe(1);
        expect(r.missingRefs).toContain('cp_2');
        expect(r.missingRefs).toContain('mem_1');
    });
});
// ���� CrossSessionMemory Tests ����
describe('CrossSessionMemory', () => {
    let csm;
    beforeEach(() => { csm = new CrossSessionMemory(new MemoryStorageBackend()); });
    function snap(sessionId, status = 'active') {
        return { snapshotId: '', snapshotVersion: '2.0.0', sessionId, createdAt: Date.now(), workingDirectory: '/t', modelConfig: { provider: 't', model: 'm', temperature: 0, maxContextTokens: 100, maxResponseTokens: 50 }, status: status, layers: { system: [], working: [{ role: 'user', content: 'hi' }], history: [] }, toolCallHistory: [], checkpointRefs: [], memoryRefs: [], metadata: {}, checksum: '' };
    }
    it('should save snapshot', async () => {
        const r = await csm.save(snap('csm-s'));
        expect(r.success).toBe(true);
        expect(r.snapshotId).toBeTruthy();
    });
    it('should restore by snapshotId', async () => {
        const saved = await csm.save(snap('csm-s'));
        const restored = await csm.restore(saved.snapshotId, 'full');
        expect(restored.messages.length).toBe(1);
    });
    it('should list sessions', async () => {
        await csm.save(snap('s1'));
        expect((await csm.listSessions()).length).toBe(1);
    });
    it('should delete session', async () => {
        const saved = await csm.save(snap('sdel'));
        await csm.deleteSession(saved.snapshotId);
        expect(await csm.autoRestore()).toBeNull();
    });
    it('should autoRestore interrupted', async () => {
        const saved = await csm.save(snap('interrupted', 'interrupted'));
        const r = await csm.autoRestore();
        expect(r).not.toBeNull();
    });
    it('should get version manager', () => {
        expect(csm.getVersionManager()).toBeInstanceOf(SchemaVersionManager);
        expect(csm.getGC()).toBeDefined();
    });
});
// ���� NudgerAdapter Tests ����
describe('NudgerAdapter', () => {
    it('should call nudger review', () => {
        const nudger = { review: vi.fn().mockReturnValue({ insight: true }) };
        const adapter = new NudgerAdapter(nudger, new IncrementalSnapshotter(), new ContextPersistor({ backend: new MemoryStorageBackend(), versionManager: new SchemaVersionManager(new MigrationPipeline()) }));
        adapter.onNudge({ messages: [{ role: 'user', content: 'hi' }] }, null);
        expect(nudger.review).toHaveBeenCalled();
    });
    it('should handle null return gracefully', () => {
        const adapter = new NudgerAdapter({ review: vi.fn().mockReturnValue(null) }, new IncrementalSnapshotter(), new ContextPersistor({ backend: new MemoryStorageBackend(), versionManager: new SchemaVersionManager(new MigrationPipeline()) }));
        expect(() => adapter.onNudge({ messages: [] }, null)).not.toThrow();
    });
});
// ���� ReflectorAdapter Tests ����
describe('ReflectorAdapter', () => {
    it('should reflect and consume', () => {
        const r = { reflect: vi.fn().mockReturnValue({ insights: ['i1'], patterns: [], preferences: [] }) };
        const adapter = new ReflectorAdapter(r);
        adapter.onReflect(['mem']);
        expect(r.reflect).toHaveBeenCalledWith(['mem']);
        const result = adapter.consumeReflectorResult();
        expect(result.insights).toEqual(['i1']);
    });
    it('should return null when no result', () => {
        expect(new ReflectorAdapter({ reflect: vi.fn() }).consumeReflectorResult()).toBeNull();
    });
    it('should clear after consume', () => {
        const a = new ReflectorAdapter({ reflect: vi.fn().mockReturnValue({ insights: [], patterns: [], preferences: [] }) });
        a.onReflect([]);
        a.consumeReflectorResult();
        expect(a.consumeReflectorResult()).toBeNull();
    });
});
// ���� ShutdownHook Tests ����
describe('ShutdownHook', () => {
    it('should register cleanup', () => {
        const shutdown = { registerCleanup: vi.fn() };
        new ShutdownHook().register(shutdown, {}, () => null);
        expect(shutdown.registerCleanup).toHaveBeenCalled();
    });
    it('should persist on shutdown', async () => {
        let cleanup = () => { };
        const shutdown = { registerCleanup: vi.fn((fn) => { cleanup = fn; }) };
        const backend = new MemoryStorageBackend();
        const hook = new ShutdownHook();
        const snap = { snapshotId: 'ss_shut', snapshotVersion: '2.0.0', sessionId: 'shut', createdAt: Date.now(), workingDirectory: '/t', modelConfig: { provider: 't', model: 'm', temperature: 0, maxContextTokens: 100, maxResponseTokens: 50 }, status: 'active', layers: { system: [], working: [], history: [] }, toolCallHistory: [], checkpointRefs: [], memoryRefs: [], metadata: {}, checksum: '' };
        hook.register(shutdown, new ContextPersistor({ backend, versionManager: new SchemaVersionManager(new MigrationPipeline()) }), () => snap);
        await cleanup();
        expect(await backend.load('ss_shut')).not.toBeNull();
    });
});
//# sourceMappingURL=cross-session-advanced.test.js.map