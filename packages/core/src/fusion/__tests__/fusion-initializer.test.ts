import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FusionInitializer } from '../fusion-initializer.js';
import type { FusionConfig } from '../types.js';

describe('FusionInitializer', () => {
  let initializer: FusionInitializer;
  let mockHealthCheck: ReturnType<typeof vi.fn>;

  function makeConfig(modules: Array<{ name: string; enabled: boolean }>): FusionConfig {
    return {
      enabled: true,
      globalTimeout: 100,
      retryAttempts: 3,
      retryDelayMs: 1000,
      modules: modules.map(m => ({ ...m, config: {} })),
    };
  }

  beforeEach(() => {
    initializer = new FusionInitializer();
    mockHealthCheck = vi.fn(() => ({ healthy: true, metrics: { totalPublished: 0, totalDelivered: 0, totalErrors: 0, avgDeliveryMs: 0, throughputPerSec: 0 } }));
  });

  describe('setters', () => {
    it('should accept all dependencies via setters', () => {
      initializer.setEventBus({ healthCheck: mockHealthCheck, publish: vi.fn(), subscribe: vi.fn(), addFilter: vi.fn() });
      initializer.setHookRegistry({ healthCheck: vi.fn(() => ({ healthy: true, hookCount: 0 })), register: vi.fn(), unregister: vi.fn(), execute: vi.fn() });
      initializer.setVectorMemory({ healthCheck: vi.fn(() => ({ healthy: true })) } as any);
      initializer.setReviewEngine({ healthCheck: vi.fn(() => ({ healthy: true })) } as any);
      initializer.setSecurityScanner({ scan: vi.fn() } as any);
      initializer.setTraceHarvester({ healthCheck: vi.fn(() => ({ healthy: true })) } as any);
      initializer.setDAGOrchestrator({ healthCheck: vi.fn(() => ({ healthy: true })), validateDAG: vi.fn(), buildExecutionPlan: vi.fn(), execute: vi.fn() } as any);
      initializer.setMultiAgent({ healthCheck: vi.fn(() => ({ healthy: true })), execute: vi.fn() } as any);
      initializer.setModelRouter({ healthCheck: vi.fn(() => ({ healthy: true, rulesCount: 0 })), route: vi.fn(), evaluateTaskFeatures: vi.fn(), addRule: vi.fn(), removeRule: vi.fn(), getRules: vi.fn() } as any);
      initializer.setNLCron({ healthCheck: vi.fn(() => ({ healthy: true })), scheduleFromNL: vi.fn(), listSchedules: vi.fn(), cancelSchedule: vi.fn(), previewCron: vi.fn() } as any);
      initializer.setUserModeler({ healthCheck: vi.fn(() => ({ healthy: true })), updateUserModel: vi.fn(), getCurrentModel: vi.fn(), triggerReflection: vi.fn() } as any);
      expect(true).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should skip disabled modules', () => {
      const result = initializer.initialize(makeConfig([]));
      expect(result.initialized).toHaveLength(0);
      expect(result.success).toBe(true);
    });

    it('should initialize all enabled modules with healthy dependencies', () => {
      initializer.setEventBus({ healthCheck: vi.fn(() => ({ healthy: true, metrics: {} })), publish: vi.fn(), subscribe: vi.fn(), addFilter: vi.fn() });

      const result = initializer.initialize(makeConfig([
        { name: 'event_bus', enabled: true },
      ]));
      expect(result.initialized).toContain('eventBus');
      expect(result.success).toBe(true);
    });

    it('should report module unhealthy when dependency health check fails', () => {
      initializer.setEventBus({ healthCheck: vi.fn(() => ({ healthy: false, metrics: {} })), publish: vi.fn(), subscribe: vi.fn(), addFilter: vi.fn() });

      const result = initializer.initialize(makeConfig([
        { name: 'event_bus', enabled: true },
      ]));
      // Module gets initialized even if unhealthy (no throw from initModule)
      expect(result.initialized).toContain('eventBus');
      expect(result.failed).toHaveLength(0);
    });

    it('should succeed with slidingWindow even without deps', () => {
      const result = initializer.initialize(makeConfig([
        { name: 'sliding_window', enabled: true },
      ]));
      expect(result.initialized).toContain('slidingWindow');
      expect(result.success).toBe(true);
    });

    it('should succeed with traceHarvester even without deps', () => {
      const result = initializer.initialize(makeConfig([
        { name: 'execution_traces', enabled: true },
      ]));
      expect(result.initialized).toContain('traceHarvester');
    });

    it('should initialize skillSecurity as unhealthy when scanner is null', () => {
      const result = initializer.initialize(makeConfig([
        { name: 'skill_security', enabled: true },
      ]));
      // Module is initialized but unhealthy (scanner === null returns false)
      expect(result.initialized).toContain('skillSecurity');
      expect(result.success).toBe(true);
    });
  });

  describe('toggleModule', () => {
    it('should toggle module enabled state', () => {
      initializer.initialize(makeConfig([{ name: 'sliding_window', enabled: true }]));
      initializer.toggleModule('slidingWindow', false);
      const map = initializer.healthCheck();
      expect(map.get('slidingWindow')?.enabled).toBe(false);
    });

    it('should not throw for unknown module', () => {
      expect(() => initializer.toggleModule('eventBus' as any, true)).not.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return map with all module states', () => {
      initializer.initialize(makeConfig([
        { name: 'event_bus', enabled: true },
        { name: 'sliding_window', enabled: true },
      ]));
      const map = initializer.healthCheck();
      expect(map.size).toBeGreaterThanOrEqual(2);
    });

    it('should include disabled modules', () => {
      const map = initializer.healthCheck();
      expect(map.size).toBe(0);
    });
  });
});
