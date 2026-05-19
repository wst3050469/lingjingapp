import { SecurityScanner, SecurityFixIntegration } from '@codepilot/core/security';
import type { ScanResult, SecurityRule } from '@codepilot/core/security';
import { getDatabase, saveDatabase } from '../db/database.js';

export class SecurityService {
  private scanner: SecurityScanner;
  private fixIntegration: SecurityFixIntegration;
  private projectPath: string;
  private currentAbort: (() => void) | null = null;

  constructor(projectPath: string, llmProvider?: any) {
    this.projectPath = projectPath;
    this.scanner = new SecurityScanner();
    this.fixIntegration = new SecurityFixIntegration(llmProvider);
  }

  async scan(scope: 'full' | 'incremental' | 'specified' = 'full', specifiedFiles?: string[], onProgress?: (progress: any) => void): Promise<ScanResult> {
    const result = await this.scanner.scan(this.projectPath, scope, specifiedFiles, onProgress);
    const db = getDatabase();
    db.run(`INSERT INTO scan_results (id, scope, target_files, vulnerabilities, summary, total_count, critical_count, high_count, medium_count, low_count, info_count, duration_ms, project_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [result.id, result.scope, JSON.stringify(result.targetFiles || []), JSON.stringify(result.vulnerabilities), JSON.stringify(result.summary), result.summary.total, result.summary.bySeverity.critical, result.summary.bySeverity.high, result.summary.bySeverity.medium, result.summary.bySeverity.low, result.summary.bySeverity.info, result.durationMs, this.projectPath]);
    await saveDatabase();
    return result;
  }

  cancelScan(): void {
    this.scanner.cancel();
  }

  async getResult(scanId: string): Promise<any> {
    const db = getDatabase();
    const result = db.exec(`SELECT * FROM scan_results WHERE id = ?`, [scanId]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const row = result[0].values[0];
    const obj: any = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  }

  async listResults(limit: number = 20): Promise<any[]> {
    const db = getDatabase();
    const result = db.exec(`SELECT * FROM scan_results WHERE project_path = ? ORDER BY scanned_at DESC LIMIT ?`, [this.projectPath, limit]);
    if (!result.length || !result[0].values.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }

  async applyFix(vulnerability: any): Promise<{ success: boolean }> {
    if (vulnerability.fixDiff) {
      return this.fixIntegration.applyFix(vulnerability, vulnerability.fixDiff);
    }
    const suggestion = await this.fixIntegration.generateFix(vulnerability, this.projectPath);
    if (suggestion.fixDiff) {
      return this.fixIntegration.applyFix(vulnerability, suggestion.fixDiff);
    }
    return { success: false };
  }

  async saveRule(rule: SecurityRule): Promise<void> {
    const db = getDatabase();
    db.run(`INSERT OR REPLACE INTO security_rules (id, name, vulnerability_type, pattern, pattern_type, severity, languages, message, suggestion, builtin, project_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule.id, rule.name, rule.vulnerabilityType, rule.pattern, rule.patternType, rule.severity, JSON.stringify(rule.languages), rule.message, rule.suggestion || '', rule.builtin ? 1 : 0, this.projectPath]);
    await saveDatabase();
  }

  async listRules(): Promise<any[]> {
    const db = getDatabase();
    const result = db.exec(`SELECT * FROM security_rules WHERE project_path = ?`, [this.projectPath]);
    if (!result.length || !result[0].values.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }

  async deleteRule(ruleId: string): Promise<void> {
    const db = getDatabase();
    db.run(`DELETE FROM security_rules WHERE id = ? AND builtin = 0`, [ruleId]);
    await saveDatabase();
  }

  async compareResults(scanId1: string, scanId2: string): Promise<any> {
    const r1 = await this.getResult(scanId1);
    const r2 = await this.getResult(scanId2);
    if (!r1 || !r2) return null;
    const v1 = new Set((JSON.parse(r1.vulnerabilities) || []).map((v: any) => `${v.ruleId}:${v.filePath}:${v.line}`));
    const v2 = new Set((JSON.parse(r2.vulnerabilities) || []).map((v: any) => `${v.ruleId}:${v.filePath}:${v.line}`));
    const added = [...v2].filter(k => !v1.has(k));
    const fixed = [...v1].filter(k => !v2.has(k));
    const remaining = [...v1].filter(k => v2.has(k));
    return { added: added.length, fixed: fixed.length, remaining: remaining.length, addedKeys: added, fixedKeys: fixed };
  }
}
