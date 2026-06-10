import { createLogger } from '../monitoring/logger';
import { SecurityScanner } from '@codepilot/core/fusion';

const logger = createLogger('skill-security-gateway');

export class SkillSecurityGateway {
  private scanner = new SecurityScanner();

  preInstallScan(content: string, skillPath: string): { allowed: boolean; riskLevel: string; findings: any[] } {
    const result = this.scanner.scan(content, skillPath);
    return {
      allowed: result.allowed,
      riskLevel: result.riskLevel,
      findings: result.findings,
    };
  }

  blockOnCritical(scanResult: { riskLevel: string; allowed: boolean }): boolean {
    if (scanResult.riskLevel === 'high' || !scanResult.allowed) {
      logger.warn('Installation blocked due to critical risk', { riskLevel: scanResult.riskLevel });
      return true;
    }
    return false;
  }

  generateReport(scanResult: { riskLevel: string; findings: any[] }): string {
    const lines = [
      `Security Scan Report`,
      `Risk Level: ${scanResult.riskLevel}`,
      `Findings: ${scanResult.findings.length}`,
      '',
    ];
    for (const finding of scanResult.findings) {
      lines.push(`  [${finding.severity}] ${finding.type}: ${finding.description} (${finding.location})`);
    }
    return lines.join('\n');
  }
}

export const skillSecurityGateway = new SkillSecurityGateway();