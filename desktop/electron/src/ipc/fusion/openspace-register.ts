import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';

let cachedFusionMod: any = null;
let sharedPM: any = null;
let sharedAdapter: any = null;

async function getFusionMod() {
  if (!cachedFusionMod) {
    cachedFusionMod = await import('@codepilot/core/fusion');
  }
  return cachedFusionMod;
}

async function getPM() {
  const mod = await getFusionMod();
  if (!mod.OpenSpaceProcessManager) return null;
  if (!sharedPM) {
    sharedPM = new mod.OpenSpaceProcessManager();
  }
  return sharedPM;
}

async function getAdapter() {
  const mod = await getFusionMod();
  if (!mod.OpenSpaceFusionAdapter) return null;
  if (!sharedAdapter) {
    sharedAdapter = new mod.OpenSpaceFusionAdapter();
  }
  return sharedAdapter;
}

export function registerOpenSpaceIPC(mainWindow: BrowserWindow): void {
  ipcMain.handle('openspace:start', async (_event, config) => {
    try {
      const pm = await getPM();
      if (!pm) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const result = await pm.start(config);
      mainWindow?.webContents.send('openspace:status-changed', { status: 'started', processId: result });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:stop', async (_event, processId) => {
    try {
      const pm = await getPM();
      if (!pm) return { success: false, error: 'OpenSpaceProcessManager not available' };
      await pm.stop(processId);
      mainWindow?.webContents.send('openspace:status-changed', { status: 'stopped', processId });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:execute-script', async (_event, request) => {
    try {
      const adapter = await getAdapter();
      if (!adapter) return { success: false, error: 'OpenSpaceFusionAdapter not available' };
      const result = await adapter.executeScript(request);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:health-check', async (_event, processId) => {
    try {
      const pm = await getPM();
      if (!pm) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const result = await pm.healthCheck(processId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:list-profiles', async () => {
    try {
      const pm = await getPM();
      if (!pm) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const profiles = await pm.listProfiles();
      return { success: true, data: profiles };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.on('openspace:subscribe-events', (_event) => {
    // Events are now pushed via mainWindow.webContents.send('openspace:status-changed', ...)
  });
}
