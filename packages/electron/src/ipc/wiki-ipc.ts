// Wiki IPC handler - exposes wiki generation/update/sync to renderer

import { ipcMain, type BrowserWindow } from 'electron';
import { WikiService } from '../services/wiki-service.js';

const wikiService = new WikiService();

export function registerWikiIpc(mainWindow: BrowserWindow, getWorkspace: () => string): void {

  function sendWikiEvent(event: Record<string, unknown>): void {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wiki:event', event);
    }
  }

  // Get wiki status for current workspace
  ipcMain.handle('wiki:status', async () => {
    try {
      const workspace = getWorkspace();
      if (!workspace) return { hasWiki: false, language: 'zh', moduleCount: 0, baseCommit: '', generatedAt: '', workspaceMissing: true };
      return await wikiService.getStatus(workspace);
    } catch (err) {
      console.error('wiki:status error:', err);
      return { hasWiki: false, language: 'zh', moduleCount: 0, baseCommit: '', generatedAt: '' };
    }
  });

  // Start full wiki generation
  ipcMain.handle('wiki:generate', async () => {
    try {
      const workspace = getWorkspace();
      if (!workspace) {
        sendWikiEvent({ type: 'error', message: 'No workspace set' });
        return;
      }

      await wikiService.generate(workspace, (progress) => {
        sendWikiEvent({ type: 'progress', ...progress });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('wiki:generate error:', msg);
      sendWikiEvent({ type: 'error', message: msg });
    }
  });

  // Detect changes since last generation
  ipcMain.handle('wiki:detect-changes', async () => {
    try {
      const workspace = getWorkspace();
      if (!workspace) return { changedModules: [], baseCommit: '', currentCommit: '' };
      return await wikiService.detectChanges(workspace);
    } catch (err) {
      console.error('wiki:detect-changes error:', err);
      return { changedModules: [], baseCommit: '', currentCommit: '' };
    }
  });

  // Start incremental update for changed modules
  ipcMain.handle('wiki:update', async (_event, params?: { modules?: string[] }) => {
    try {
      const workspace = getWorkspace();
      if (!workspace) {
        sendWikiEvent({ type: 'error', message: 'No workspace set' });
        return;
      }

      let modulesToUpdate = params?.modules;
      if (!modulesToUpdate || modulesToUpdate.length === 0) {
        const changes = await wikiService.detectChanges(workspace);
        modulesToUpdate = changes.changedModules;
      }

      if (modulesToUpdate.length === 0) {
        sendWikiEvent({ type: 'progress', phase: 'done', current: 0, total: 0 });
        return;
      }

      await wikiService.updateModules(workspace, modulesToUpdate, (progress) => {
        sendWikiEvent({ type: 'progress', ...progress });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('wiki:update error:', msg);
      sendWikiEvent({ type: 'error', message: msg });
    }
  });

  // Check for external edits to wiki .md files
  ipcMain.handle('wiki:check-sync', async () => {
    try {
      const workspace = getWorkspace();
      if (!workspace) return { editedFiles: [] };
      const edited = await wikiService.checkExternalEdits(workspace);
      return { editedFiles: edited };
    } catch (err) {
      console.error('wiki:check-sync error:', err);
      return { editedFiles: [] };
    }
  });

  // Load table of contents
  ipcMain.handle('wiki:load-toc', async () => {
    try {
      const workspace = getWorkspace();
      if (!workspace) return { modules: [], hasOverview: false };
      return await wikiService.loadToc(workspace);
    } catch (err) {
      console.error('wiki:load-toc error:', err);
      return { modules: [], hasOverview: false };
    }
  });

  // Load content for a specific module (or 'overview')
  ipcMain.handle('wiki:load-content', async (_event, { modulePath }: { modulePath: string }) => {
    try {
      const workspace = getWorkspace();
      if (!workspace) return { content: '' };
      const content = await wikiService.loadContent(workspace, modulePath);
      return { content };
    } catch (err) {
      console.error('wiki:load-content error:', err);
      return { content: '' };
    }
  });

  // Abort in-progress generation/update
  ipcMain.handle('wiki:abort', async () => {
    wikiService.abort();
  });
}
