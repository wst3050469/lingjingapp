import { describe, it, expect } from 'vitest';
import { SkillSecurityGateway } from '../skill-security-gateway';

describe('SkillSecurityGateway', () => {
  const gateway = new SkillSecurityGateway();

  describe('preInstallScan', () => {
    it('should return scan result with allowed and riskLevel', () => {
      const result = gateway.preInstallScan('const x = 1;', '/skills/test');
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('findings');
    });
  });

  describe('blockOnCritical', () => {
    it('should block high risk results', () => {
      expect(gateway.blockOnCritical({ riskLevel: 'high', allowed: false })).toBe(true);
    });

    it('should not block low risk results', () => {
      expect(gateway.blockOnCritical({ riskLevel: 'low', allowed: true })).toBe(false);
    });

    it('should block when not allowed', () => {
      expect(gateway.blockOnCritical({ riskLevel: 'medium', allowed: false })).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate a readable report', () => {
      const report = gateway.generateReport({
        riskLevel: 'low',
        findings: [{ type: 'command_injection', severity: 'low', description: 'test', location: 'line 1' }],
      });
      expect(report).toContain('low');
      expect(report).toContain('1');
    });
  });
});