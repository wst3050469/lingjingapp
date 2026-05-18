import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityScanner } from '../skill-security/security-scanner.js';

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;

  beforeEach(() => {
    scanner = new SecurityScanner();
  });

  describe('scan', () => {
    it('should return allowed=true for safe content', () => {
      const result = scanner.scan('console.log("hello world")', '/skills/test');
      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe('none');
      expect(result.findings).toHaveLength(0);
    });

    it('should detect command injection', () => {
      const result = scanner.scan('exec("rm -rf /")', '/skills/test');
      expect(result.findings.some(f => f.type === 'command_injection')).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.allowed).toBe(false);
    });

    it('should detect path traversal', () => {
      const result = scanner.scan('../../etc/passwd', '/skills/test');
      expect(result.findings.some(f => f.type === 'path_traversal')).toBe(true);
      expect(result.riskLevel).toBe('high');
    });

    it('should detect privilege escalation', () => {
      const result = scanner.scan('sudo rm -rf /', '/skills/test');
      expect(result.findings.some(f => f.type === 'privilege_escalation')).toBe(true);
    });

    it('should detect data leakage', () => {
      const result = scanner.scan('password = "supersecret"', '/skills/test');
      expect(result.findings.some(f => f.type === 'data_leakage')).toBe(true);
    });

    it('should report correct location line numbers', () => {
      const content = [
        'safe line',
        'exec("danger")',
        'another safe line',
        'sudo rm -rf',
      ].join('\n');
      const result = scanner.scan(content, '/skills/test');
      const cmdFinding = result.findings.find(f => f.type === 'command_injection');
      expect(cmdFinding?.location).toBe('line 2');
      const privFinding = result.findings.find(f => f.type === 'privilege_escalation');
      expect(privFinding?.location).toBe('line 4');
    });

    it('should include skillPath in result', () => {
      const result = scanner.scan('safe', '/custom/skill.js');
      expect(result.skillPath).toBe('/custom/skill.js');
    });
  });

  describe('checkCommandInjection', () => {
    it('should detect exec() calls', () => {
      const findings = scanner.checkCommandInjection('exec("ls")');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
    });

    it('should detect spawn() calls', () => {
      const findings = scanner.checkCommandInjection('spawn("bash")');
      expect(findings).toHaveLength(1);
    });

    it('should detect shell:true option', () => {
      const findings = scanner.checkCommandInjection('shell: true');
      expect(findings).toHaveLength(1);
    });
  });

  describe('checkPathTraversal', () => {
    it('should detect ../ patterns', () => {
      const findings = scanner.checkPathTraversal('open("../../file")');
      expect(findings.some(f => f.description.includes('../'))).toBe(true);
    });
  });

  describe('checkPrivilegeEscalation', () => {
    it('should detect sudo usage', () => {
      const findings = scanner.checkPrivilegeEscalation('sudo service restart');
      expect(findings.some(f => f.description.includes('sudo'))).toBe(true);
    });

    it('should detect chmod 777', () => {
      const findings = scanner.checkPrivilegeEscalation('chmod 777 /etc/shadow');
      expect(findings.some(f => f.description.includes('chmod'))).toBe(true);
    });
  });

  describe('checkDataLeakage', () => {
    it('should detect password assignments', () => {
      const findings = scanner.checkDataLeakage('password: "hunter2"');
      expect(findings.some(f => f.type === 'data_leakage')).toBe(true);
    });

    it('should detect secret assignments', () => {
      const findings = scanner.checkDataLeakage('secret= "mykey"');
      expect(findings.some(f => f.type === 'data_leakage')).toBe(true);
    });

    it('should detect api_key assignments', () => {
      const findings = scanner.checkDataLeakage('apiKey = "sk-xxxx"');
      expect(findings.some(f => f.type === 'data_leakage')).toBe(true);
    });
  });

  describe('custom config', () => {
    it('should skip rules not in config', () => {
      const minimal = new SecurityScanner({ scanRules: ['command_injection'] });
      const result = minimal.scan('../../file', '/test');
      expect(result.findings).toHaveLength(0);
    });

    it('should allow high risk when blockOnHighRisk is false', () => {
      const permissive = new SecurityScanner({ blockOnHighRisk: false });
      const result = permissive.scan('exec("rm -rf /")', '/test');
      expect(result.allowed).toBe(true);
    });
  });
});
