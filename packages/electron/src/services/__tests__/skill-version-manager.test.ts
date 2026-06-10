import { describe, it, expect } from 'vitest';
import { SkillVersionManager } from '../skill-version-manager';

describe('SkillVersionManager', () => {
  const manager = new SkillVersionManager();

  describe('compareVersions', () => {
    it('should compare equal versions', () => {
      expect(manager.compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should detect newer versions', () => {
      expect(manager.compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(manager.compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(manager.compareVersions('1.0.1', '1.0.0')).toBe(1);
    });

    it('should detect older versions', () => {
      expect(manager.compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(manager.compareVersions('1.0.0', '1.1.0')).toBe(-1);
    });

    it('should handle different length versions', () => {
      expect(manager.compareVersions('1.0', '1.0.0')).toBe(0);
      expect(manager.compareVersions('1.1', '1.0.1')).toBe(1);
    });
  });
});