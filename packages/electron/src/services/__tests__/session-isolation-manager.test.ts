import { describe, it, expect } from 'vitest';
import { SessionIsolationManager } from '../session-isolation-manager';

describe('SessionIsolationManager', () => {
  const manager = new SessionIsolationManager();

  describe('createIsolatedProvider', () => {
    it('should create an isolated provider copy', () => {
      const base = { name: 'test', model: 'gpt-4' };
      const isolated = manager.createIsolatedProvider('session-1', base);
      expect(isolated.name).toBe('test');
      expect(isolated.model).toBe('gpt-4');
    });
  });

  describe('createIsolatedConfig', () => {
    it('should create a deep copy of config', () => {
      const base = { temperature: 0.3, tools: ['read', 'write'] };
      const isolated = manager.createIsolatedConfig('session-1', base);
      isolated.temperature = 0.7;
      expect(base.temperature).toBe(0.3);
      expect(isolated.temperature).toBe(0.7);
    });
  });

  describe('validateIsolation', () => {
    it('should report issues for non-isolated session', () => {
      const result = manager.validateIsolation('non-existent');
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should validate fully isolated session', () => {
      manager.createIsolatedProvider('session-1', {});
      manager.createIsolatedConfig('session-1', {});
      manager.createIsolatedTools('session-1', {});
      const result = manager.validateIsolation('session-1');
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove all isolated resources', () => {
      manager.createIsolatedProvider('session-2', {});
      manager.createIsolatedConfig('session-2', {});
      manager.createIsolatedTools('session-2', {});
      manager.cleanup('session-2');
      const result = manager.validateIsolation('session-2');
      expect(result.valid).toBe(false);
    });
  });
});