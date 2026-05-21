import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillSecurityLoader } from '../skill-security/skill-security-loader.js';
import { ConnectorHubAdapter } from '../connectors/connector-hub-adapter.js';
describe('SkillSecurityLoader', () => {
    let loader;
    let eventBus;
    let hookRegistry;
    beforeEach(() => {
        eventBus = { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() };
        hookRegistry = {
            register: vi.fn(() => 'hook_id'),
            unregister: vi.fn(),
            execute: vi.fn(),
            healthCheck: vi.fn(() => ({ healthy: true, hookCount: 0 })),
        };
        loader = new SkillSecurityLoader();
        loader.initialize(eventBus, hookRegistry);
    });
    describe('initialize', () => {
        it('should register before_skill_load hook', () => {
            loader.initialize(eventBus, hookRegistry);
            expect(hookRegistry.register).toHaveBeenCalledWith('before_skill_load', expect.any(Function), expect.objectContaining({ priority: -100 }));
        });
    });
    describe('scanAndLoad', () => {
        it('should return scan result for safe content', async () => {
            const result = await loader.scanAndLoad('/test.skill.md', 'console.log("safe")');
            expect(result.scanResult.allowed).toBe(true);
            expect(result.metadata).not.toBeNull();
        });
        it('should block high-risk content', async () => {
            const result = await loader.scanAndLoad('/test.skill.md', 'exec("rm -rf /")');
            expect(result.scanResult.allowed).toBe(false);
            expect(result.metadata).toBeNull();
        });
        it('should publish skill:blocked for dangerous content', async () => {
            await loader.scanAndLoad('/test.skill.md', 'exec("rm")');
            expect(eventBus.publish).toHaveBeenCalledWith('skill:blocked', expect.objectContaining({ skillPath: '/test.skill.md' }), 'SkillSecurityLoader');
        });
    });
    describe('loadFullSkill', () => {
        it('should return empty string for non-existent file', async () => {
            const result = await loader.loadFullSkill('/fake/path.md');
            expect(result).toBe('');
        });
    });
    describe('healthCheck', () => {
        it('should return healthy when enabled', () => {
            expect(loader.healthCheck().healthy).toBe(true);
        });
        it('should return unhealthy when disabled', () => {
            const disabled = new SkillSecurityLoader({ enabled: false });
            expect(disabled.healthCheck().healthy).toBe(false);
        });
    });
});
describe('ConnectorHubAdapter', () => {
    let hub;
    beforeEach(() => {
        hub = new ConnectorHubAdapter();
    });
    function makeConnector(name, type) {
        return {
            name,
            type,
            execute: vi.fn().mockResolvedValue('ok'),
            isAvailable: vi.fn().mockResolvedValue(true),
        };
    }
    describe('register', () => {
        it('should register a connector', () => {
            const c = makeConnector('github', 'git');
            hub.register(c);
            const discovered = hub.discover();
            expect(discovered).toHaveLength(1);
        });
    });
    describe('discover', () => {
        it('should return all connectors when no type filter', () => {
            hub.register(makeConnector('gh', 'git'));
            hub.register(makeConnector('sl', 'chat'));
            expect(hub.discover()).toHaveLength(2);
        });
        it('should filter by type', () => {
            hub.register(makeConnector('gh', 'git'));
            hub.register(makeConnector('sl', 'chat'));
            expect(hub.discover('git')).toHaveLength(1);
        });
        it('should return empty for unknown type', () => {
            expect(hub.discover('unknown')).toHaveLength(0);
        });
    });
    describe('invoke', () => {
        it('should execute connector action', async () => {
            const c = makeConnector('gh', 'git');
            hub.register(c);
            const result = await hub.invoke('gh', 'list', {});
            expect(result).toBe('ok');
            expect(c.execute).toHaveBeenCalledWith('list', {});
        });
        it('should throw for unknown connector', async () => {
            await expect(hub.invoke('unknown', 'x', {})).rejects.toThrow('not found');
        });
    });
});
//# sourceMappingURL=remaining-modules.test.js.map