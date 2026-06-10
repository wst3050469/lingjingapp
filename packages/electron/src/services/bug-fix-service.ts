import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { getDatabase, saveDatabase } from '../db/database.js';
import { BugAnalyzer, bugAnalyzer } from './bug-analyzer.js';
import { BugFixExecutor, bugFixExecutor } from './bug-fix-executor.js';
import { BugReportGenerator, bugReportGenerator } from './bug-report-generator.js';
import type { BugRecord, BugSeverity, BugStatus } from '../db/types/ide-enhance-types.js';
import type { FixResult } from './bug-fix-executor.js';
import type { BugReport } from './bug-report-generator.js';

const logger = createLogger('bug-fix-service');

export class BugFixService extends EventEmitter {
  private analyzer: BugAnalyzer;
  private executor: BugFixExecutor;
  private reporter: BugReportGenerator;

  constructor() {
    super();
    this.analyzer = bugAnalyzer;
    this.executor = bugFixExecutor;
    this.reporter = bugReportGenerator;
  }

  async analyze(): Promise<BugRecord[]> {
    const dbBugs = await this.analyzer.scanFromDb();
    const knownBugs = this.analyzer.identifyKnown();
    const knownAsRecords: BugRecord[] = knownBugs.map((kb) => ({
      id: kb.id,
      severity: kb.severity,
      module: kb.module,
      title: kb.title,
      description: kb.description,
      status: 'open' as BugStatus,
      fixDescription: '',
      affectedFiles: kb.affectedFiles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    const all = new Map<string, BugRecord>();
    for (const b of [...knownAsRecords, ...dbBugs]) {
      all.set(b.id, b);
    }
    return this.analyzer.prioritize([...all.values()]);
  }

  async fix(bugId: string, patchFn: () => Promise<boolean>): Promise<FixResult | null> {
    const bugs = await this.analyze();
    const bug = bugs.find((b) => b.id === bugId);
    if (!bug) {
      logger.warn('Bug not found', { bugId });
      return null;
    }
    const applied = await this.executor.applyFix(bug, patchFn);
    const fixResult: FixResult = {
      bugId,
      success: applied,
      appliedPatches: applied ? [bugId] : [],
      testResults: { passed: false, details: '' },
      verifiedAt: '',
    };
    if (applied) {
      await this.executor.verifyFix(bug, fixResult);
    }
    if (fixResult.success) {
      try {
        const db = getDatabase();
        db.run(
          `INSERT OR REPLACE INTO bug_records (id, severity, module, title, description, status, fix_description, affected_files, updated_at)
           VALUES (?, ?, ?, ?, ?, 'fixed', ?, ?, datetime('now'))`,
          [bug.id, bug.severity, bug.module, bug.title, bug.description, 'Applied via BugFixService', JSON.stringify(bug.affectedFiles)],
        );
        await saveDatabase();
      } catch (err) {
        logger.error('Failed to update bug status in DB', err as Error);
      }
    }
    this.emit('bug-fixed', { bugId, success: fixResult.success });
    return fixResult;
  }

  async generateReport(): Promise<BugReport> {
    const bugs = await this.analyze();
    const fixResults = new Map<string, FixResult>();
    return this.reporter.generateReport(bugs, fixResults);
  }
}

export const bugFixService = new BugFixService();