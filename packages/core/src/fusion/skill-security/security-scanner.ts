import type { SecurityFinding, SecurityScanResult, SecurityConfig } from './types.js';
import { DEFAULT_SECURITY_CONFIG } from './types.js';

export class SecurityScanner {
  private config: SecurityConfig;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  scan(content: string, skillPath: string): SecurityScanResult {
    const findings: SecurityFinding[] = [];

    if (this.config.scanRules.includes('command_injection')) {
      findings.push(...this.checkCommandInjection(content));
    }
    if (this.config.scanRules.includes('path_traversal')) {
      findings.push(...this.checkPathTraversal(content));
    }
    if (this.config.scanRules.includes('privilege_escalation')) {
      findings.push(...this.checkPrivilegeEscalation(content));
    }
    if (this.config.scanRules.includes('data_leakage')) {
      findings.push(...this.checkDataLeakage(content));
    }

    const riskLevel = this.determineRiskLevel(findings);
    const allowed = this.determineAllowed(riskLevel);

    return { skillPath, findings, riskLevel, allowed };
  }

  checkCommandInjection(content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const patterns: Array<{ regex: RegExp; desc: string }> = [
      { regex: /exec\s*\(/g, desc: 'exec() call detected' },
      { regex: /spawn\s*\(/g, desc: 'spawn() call detected' },
      { regex: /shell\s*:\s*true/g, desc: 'shell: true option detected' },
      { regex: /\$\{[^}]*\}/g, desc: 'template string command interpolation detected' },
    ];

    for (const pattern of patterns) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(lines[i])) {
          findings.push({
            type: 'command_injection',
            severity: 'high',
            description: pattern.desc,
            location: `line ${i + 1}`,
          });
        }
      }
    }

    return findings;
  }

  checkPathTraversal(content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const patterns: Array<{ regex: RegExp; desc: string; severity: 'high' | 'medium' | 'low' }> = [
      { regex: /\.\.\//g, desc: 'parent directory traversal ../', severity: 'high' },
      { regex: /\\\\/g, desc: 'parent directory traversal ..\\', severity: 'high' },
      { regex: /path\.join\s*\(\s*userInput/gi, desc: 'path.join with user input', severity: 'medium' },
    ];

    for (const pattern of patterns) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.regex.test(lines[i])) {
          findings.push({
            type: 'path_traversal',
            severity: pattern.severity,
            description: pattern.desc,
            location: `line ${i + 1}`,
          });
        }
      }
    }

    return findings;
  }

  checkPrivilegeEscalation(content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const patterns: Array<{ regex: RegExp; desc: string }> = [
      { regex: /\bsudo\b/g, desc: 'sudo usage detected' },
      { regex: /chmod\s+777/g, desc: 'chmod 777 detected' },
      { regex: /\bsetuid\b/g, desc: 'setuid call detected' },
      { regex: /\broot\b/g, desc: 'root reference detected' },
    ];

    for (const pattern of patterns) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.regex.test(lines[i])) {
          findings.push({
            type: 'privilege_escalation',
            severity: 'high',
            description: pattern.desc,
            location: `line ${i + 1}`,
          });
        }
      }
    }

    return findings;
  }

  checkDataLeakage(content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const patterns: Array<{ regex: RegExp; desc: string }> = [
      { regex: /(?:password|passwd)\s*[:=]/gi, desc: 'password variable assignment' },
      { regex: /(?:secret)\s*[:=]/gi, desc: 'secret variable assignment' },
      { regex: /(?:token)\s*[:=]/gi, desc: 'token variable assignment' },
      { regex: /(?:api_key|apikey)\s*[:=]/gi, desc: 'api_key variable assignment' },
    ];

    for (const pattern of patterns) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.regex.test(lines[i])) {
          findings.push({
            type: 'data_leakage',
            severity: 'medium',
            description: pattern.desc,
            location: `line ${i + 1}`,
          });
        }
      }
    }

    return findings;
  }

  private determineRiskLevel(findings: SecurityFinding[]): 'high' | 'medium' | 'low' | 'none' {
    if (findings.some((f) => f.severity === 'high')) return 'high';
    if (findings.some((f) => f.severity === 'medium')) return 'medium';
    if (findings.some((f) => f.severity === 'low')) return 'low';
    return 'none';
  }

  private determineAllowed(riskLevel: 'high' | 'medium' | 'low' | 'none'): boolean {
    if (riskLevel === 'high' && this.config.blockOnHighRisk) return false;
    if (riskLevel === 'medium' && this.config.warnOnMediumRisk) return true;
    return true;
  }
}
