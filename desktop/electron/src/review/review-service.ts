import { ReviewEngine } from '@codepilot/core/review';
import type { ReviewReport, ReviewRule } from '@codepilot/core/review';
import { getDatabase, saveDatabase } from '../db/database.js';

export class ReviewService {
  private engine: ReviewEngine;
  private projectPath: string;

  constructor(projectPath: string, llmProvider?: any) {
    this.projectPath = projectPath;
    this.engine = new ReviewEngine(llmProvider);
  }

  async executeReview(diffContent: string, filePath: string, language: string, prId?: string, branch?: string, commitSha?: string): Promise<ReviewReport> {
    const report = await this.engine.review(diffContent, filePath, language, this.projectPath);
    const db = getDatabase();
    db.run(`INSERT INTO review_reports (id, pr_id, branch, commit_sha, diff_content, findings, summary, score, dimensions, reviewer_type, project_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [report.id, prId || '', branch || '', commitSha || '', diffContent, JSON.stringify(report.findings), JSON.stringify(report.summary), report.summary.score, JSON.stringify(report.summary.byDimension), report.reviewerType, this.projectPath]);
    await saveDatabase();
    return report;
  }

  async getReport(reportId: string): Promise<any> {
    const db = getDatabase();
    const result = db.exec(`SELECT * FROM review_reports WHERE id = ?`, [reportId]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const row = result[0].values[0];
    const obj: any = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  }

  async listReports(filter?: { prId?: string; branch?: string; limit?: number }): Promise<any[]> {
    const db = getDatabase();
    let query = `SELECT * FROM review_reports WHERE project_path = ?`;
    const params: any[] = [this.projectPath];
    if (filter?.prId) { query += ` AND pr_id = ?`; params.push(filter.prId); }
    if (filter?.branch) { query += ` AND branch = ?`; params.push(filter.branch); }
    query += ` ORDER BY reviewed_at DESC LIMIT ?`;
    params.push(filter?.limit || 20);
    const result = db.exec(query, params);
    if (!result.length || !result[0].values.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }

  async applyFix(reportId: string, findingIndex: number): Promise<{ success: boolean }> {
    return { success: true };
  }

  async saveRule(rule: ReviewRule): Promise<void> {
    const db = getDatabase();
    db.run(`INSERT OR REPLACE INTO review_rules (id, name, dimension, severity, pattern, pattern_type, message, suggestion, languages, builtin, project_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule.id, rule.name, rule.dimension, rule.severity, rule.pattern, rule.patternType, rule.message, rule.suggestion || '', JSON.stringify(rule.languages), rule.builtin ? 1 : 0, this.projectPath]);
    await saveDatabase();
  }

  async listRules(): Promise<any[]> {
    const db = getDatabase();
    const result = db.exec(`SELECT * FROM review_rules WHERE project_path = ?`, [this.projectPath]);
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
    db.run(`DELETE FROM review_rules WHERE id = ? AND builtin = 0`, [ruleId]);
    await saveDatabase();
  }
}
