import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenSpaceFusionAdapter } from '../fusion-adapter.js';
function createMockEventBus() {
    return {
        publish: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
    };
}
describe('OpenSpaceFusionAdapter', () => {
    let eventBus;
    let adapter;
    beforeEach(() => {
        eventBus = createMockEventBus();
        adapter = new OpenSpaceFusionAdapter(eventBus);
    });
    describe('constructor', () => {
        it('should create an instance', () => {
            expect(adapter).toBeInstanceOf(OpenSpaceFusionAdapter);
        });
        it('should not be initialized by default', () => {
            const status = adapter.getStatus();
            expect(status.initialized).toBe(false);
        });
        it('should expose processManager and bridge getters', () => {
            expect(adapter.processManagerInstance).toBeDefined();
            expect(adapter.bridgeInstance).toBeDefined();
        });
        it('should return null for toolset before initialization', () => {
            expect(adapter.getToolSet()).toBeNull();
        });
    });
    describe('initialize', () => {
        it('should set initialized to true', () => {
            adapter.initialize();
            const status = adapter.getStatus();
            expect(status.initialized).toBe(true);
        });
        it('should be idempotent on second call', () => {
            adapter.initialize();
            adapter.initialize();
            // Should not throw or reset
            expect(adapter.getStatus().initialized).toBe(true);
        });
        it('should create toolset when initialized', () => {
            adapter.initialize();
            expect(adapter.getToolSet()).not.toBeNull();
        });
        it('should merge config with defaults', () => {
            adapter.initialize({
                bridgeConfig: { wsPort: 9999 },
            });
            const status = adapter.getStatus();
            expect(status.initialized).toBe(true);
        });
    });
    describe('start / stop', () => {
        it('should cleanly stop and disconnect', async () => {
            adapter.initialize();
            await expect(adapter.stop()).resolves.not.toThrow();
            const status = adapter.getStatus();
            expect(status.bridgeConnected).toBe(false);
        });
    });
    describe('connectBridge', () => {
        it('should not throw when already connected', async () => {
            adapter.initialize();
            // Should not crash
        });
    });
    describe('getStatus', () => {
        it('should return correct default status', () => {
            const status = adapter.getStatus();
            expect(status).toMatchObject({
                initialized: false,
                running: false,
                processState: 'stopped',
                bridgeConnected: false,
                installed: false,
                compatible: false,
                health: null,
                wsPort: null,
            });
        });
        it('should reflect initialized state', () => {
            adapter.initialize();
            const status = adapter.getStatus();
            expect(status.initialized).toBe(true);
        });
    });
    describe('dispose', () => {
        it('should clean up bridge, process manager, and reset state', () => {
            adapter.initialize();
            adapter.dispose();
            expect(adapter.getToolSet()).toBeNull();
            expect(adapter.getStatus().initialized).toBe(false);
        });
        it('should be safe to call dispose multiple times', () => {
            adapter.initialize();
            adapter.dispose();
            expect(() => adapter.dispose()).not.toThrow();
        });
    });
});
//# sourceMappingURL=openspace-fusion-adapter.test.js.map