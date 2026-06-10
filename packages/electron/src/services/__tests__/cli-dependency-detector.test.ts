import { describe, it, expect } from 'vitest';
import { parseVersion, checkVersionRange } from '../cli-dependency-detector';

describe('CliDependencyDetector', () => {
  describe('parseVersion', () => {
    it('should parse version from output', () => {
      expect(parseVersion('KiCad CLI 7.0.11')).toBe('7.0.11');
      expect(parseVersion('OpenSCAD version 2021.01')).toBe('2021.01');
      expect(parseVersion('8.0.0')).toBe('8.0.0');
    });
  });

  describe('checkVersionRange', () => {
    it('should check >=7.0.0 <9.0.0 for KiCad', () => {
      expect(checkVersionRange('7.0.0', '>=7.0.0 <9.0.0')).toBe(true);
      expect(checkVersionRange('8.5.0', '>=7.0.0 <9.0.0')).toBe(true);
      expect(checkVersionRange('6.0.0', '>=7.0.0 <9.0.0')).toBe(false);
      expect(checkVersionRange('9.0.0', '>=7.0.0 <9.0.0')).toBe(false);
    });

    it('should check >=2021.01 for OpenSCAD', () => {
      expect(checkVersionRange('2021.01', '>=2021.01')).toBe(true);
      expect(checkVersionRange('2023.05', '>=2021.01')).toBe(true);
      expect(checkVersionRange('2020.12', '>=2021.01')).toBe(false);
    });
  });
});