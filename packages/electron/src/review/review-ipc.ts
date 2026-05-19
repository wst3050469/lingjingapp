import { ipcMain } from 'electron';
import { ReviewService } from './review-service.js';

const services = new Map<string, ReviewService>();

function getService(projectPath: string): ReviewService {
  if (!services.has(projectPath)) services.set(projectPath, new ReviewService(projectPath));
  return services.get(projectPath)!;
}

export function registerReviewIPC(): void {
  ipcMain.handle('review:execute', async (_e, projectPath: string, diff: string, filePath: string, lang: string, prId?: string, branch?: string, sha?: string) => {
    return getService(projectPath).executeReview(diff, filePath, lang, prId, branch, sha);
  });
  ipcMain.handle('review:getReport', async (_e, projectPath: string, reportId: string) => {
    return getService(projectPath).getReport(reportId);
  });
  ipcMain.handle('review:listReports', async (_e, projectPath: string, filter?: any) => {
    return getService(projectPath).listReports(filter);
  });
  ipcMain.handle('review:applyFix', async (_e, projectPath: string, reportId: string, idx: number) => {
    return getService(projectPath).applyFix(reportId, idx);
  });
  ipcMain.handle('review:saveRule', async (_e, projectPath: string, rule: any) => {
    return getService(projectPath).saveRule(rule);
  });
  ipcMain.handle('review:listRules', async (_e, projectPath: string) => {
    return getService(projectPath).listRules();
  });
  ipcMain.handle('review:deleteRule', async (_e, projectPath: string, ruleId: string) => {
    return getService(projectPath).deleteRule(ruleId);
  });
}
