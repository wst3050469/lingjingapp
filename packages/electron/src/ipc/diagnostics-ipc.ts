// Diagnostics IPC handler - bridges LSP diagnostics with renderer

import { ipcMain, type BrowserWindow } from 'electron';
import { lspManager } from '../services/lsp/lsp-manager.js';

export function registerDiagnosticsIpc(mainWindow: BrowserWindow, getWorkspace: () => string): void {
  // Forward diagnostics events from LSP to renderer
  lspManager.on('diagnostics', (_serverName: string, uri: string, diagnostics: unknown[]) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('diagnostics:update', { uri, diagnostics });
    }
  });

  // Get diagnostics for a file
  ipcMain.handle('diagnostics:get', async (_event, { filePath, severity }: { filePath?: string; severity?: string }) => {
    try {
      const workspace = getWorkspace();
      lspManager.setWorkspace(workspace);

      if (filePath) {
        const result = await lspManager.getDiagnostics(filePath, severity);
        return { success: true, diagnostics: result };
      } else {
        const result = await lspManager.getProjectDiagnostics(severity);
        return { success: true, diagnostics: result };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // Check available language servers
  ipcMain.handle('diagnostics:check-servers', async () => {
    try {
      const availability = await lspManager.checkAvailability();
      return { success: true, servers: availability };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}

/** Shutdown all LSP servers (call on app quit) */
export async function shutdownLspServers(): Promise<void> {
  await lspManager.shutdownAll();
}
