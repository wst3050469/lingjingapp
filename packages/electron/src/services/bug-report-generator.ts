import { createLogger } from '../monitoring/logger';
import type { BugRecord } from '../db/types/ide-enhance-types.js';
import type { FixResult } from './bug-fix-executor.js';

const logger = createLogger('bug-report-generator');

export interface BugReport {
  generatedAt: string;
  totalBugs: number;
  bySeverity: Record<string, number>;
  byModule: Record<string, number>;
  fixes: Array<{
    bug: BugRecord;
    fixResult?: FixResult;
  }>;
}

export class BugReportGenerator {
  generateReport(bugs: BugRecord[], fixResults: Map<string, FixResult>): BugReport {
    const bySeverity: Record<string, number> = {};
    const byModule: Record<string, number> = {};
    for (const bug of bugs) {
      bySeverity[bug.severity] = (bySeverity[bug.severity] ?? 0) + 1;
      byModule[bug.module] = (byModule[bug.module] ?? 0) + 1;
    }
    return {
      generatedAt: new Date().toISOString(),
      totalBugs: bugs.length,
      bySeverity,
      byModule,
      fixes: bugs.map((bug) => ({
        bug,
        fixResult: fixResults.get(bug.id),
      })),
    };
  }

  formatResult(report: BugReport): string {
    const lines: string[] = [
      `=== Bug Report (${report.generatedAt}) ===`,
      `Total: ${report.totalBugs} bugs`,
      '',
      'By Severity:',
      ...Object.entries(report.bySeverity).map(([k, v]) => `  ${k}: ${v}`),
      '',
      'By Module:',
      ...Object.entries(report.byModule).map(([k, v]) => `  ${k}: ${v}`),
      '',
      'Fixes:',
    ];
    for (const { bug, fixResult } of report.fixes) {
      const status = fixResult?.success ? 'FIXED' : fixResult ? 'FAILED' : 'PENDING';
      lines.push(`  [${status}] ${bug.id}: ${bug.title} (${bug.severity}/${bug.module})`);
    }
    return lines.join('\n');
  }
}

export const bugReportGenerator = new BugReportGenerator();