import { ipcMain } from 'electron';
import { bugFixService } from '../services/bug-fix-service.js';
import { bugAnalyzer } from '../services/bug-analyzer.js';
import { getDatabase, saveDatabase } from '../db/database.js';

export function registerBugIpc(): void {
  ipcMain.handle('bug:list', async () => {
    try {
      return await bugFixService.analyze();
    } catch (err) {
      console.error('bug:list error:', err);
      return [];
    }
  });

  ipcMain.handle('bug:analyze', async () => {
    try {
      const bugs = await bugFixService.analyze();
      const known = bugAnalyzer.identifyKnown();
      return { bugs, knownBugs: known };
    } catch (err) {
      console.error('bug:analyze error:', err);
      return { bugs: [], knownBugs: [] };
    }
  });

  ipcMain.handle('bug:fix', async (_event, { bugId }: { bugId: string }) => {
    try {
      return await bugFixService.fix(bugId, async () => true);
    } catch (err) {
      console.error('bug:fix error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('bug:verify', async (_event, { bugId }: { bugId: string }) => {
    try {
      const report = await bugFixService.generateReport();
      const fix = report.fixes.find((f) => f.bug.id === bugId);
      return { verified: fix?.fixResult?.success ?? false, report };
    } catch (err) {
      console.error('bug:verify error:', err);
      return { verified: false, error: String(err) };
    }
  });
}