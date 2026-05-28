import { ipcMain, BrowserWindow } from 'electron';
import { getBrowserService } from '../services/browser-service.js';

export function registerBrowserIpc(mainWindow: BrowserWindow): void {
  const browserService = getBrowserService();

  ipcMain.handle('browser:initialize', async () => {
    try {
      await browserService.initialize();
      const state = browserService.getState();
      return { success: true, state };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('browser:execute', async (_event, operation: string, params: Record<string, unknown>) => {
    try {
      const result = await browserService.execute(operation as any, params);

      if (result.screenshot) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('browser:screenshot', {
            image: result.screenshot,
            url: browserService.getState().currentUrl,
            title: browserService.getState().pageTitle,
            timestamp: Date.now(),
          });
        }
      }

      const state = browserService.getState();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:status', state);
      }

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:error', { error: msg, timestamp: Date.now() });
      }
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('browser:shutdown', async () => {
    try {
      await browserService.shutdown();
      const state = browserService.getState();
      return { success: true, state };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('browser:get-state', async () => {
    return browserService.getState();
  });
}
