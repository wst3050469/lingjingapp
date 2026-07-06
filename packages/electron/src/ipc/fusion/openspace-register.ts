import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';

export function registerOpenSpaceIPC(mainWindow: BrowserWindow): void {
  ipcMain.handle('openspace:start', async (_event, config) => {
    try {
      const fusionMod = await import('@codepilot/core/fusion') as any;
      const PM = fusionMod.OpenSpaceProcessManager;
      if (!PM) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const pm = new PM();
      const result = await pm.start(config);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:stop', async (_event, processId) => {
    try {
      const fusionMod = await import('@codepilot/core/fusion') as any;
      const PM = fusionMod.OpenSpaceProcessManager;
      if (!PM) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const pm = new PM();
      await pm.stop(processId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:execute-script', async (_event, request) => {
    try {
      const fusionMod = await import('@codepilot/core/fusion') as any;
      const Adapter = fusionMod.OpenSpaceFusionAdapter;
      if (!Adapter) return { success: false, error: 'OpenSpaceFusionAdapter not available' };
      const adapter = new Adapter();
      const result = await adapter.executeScript(request);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:health-check', async (_event, processId) => {
    try {
      const fusionMod = await import('@codepilot/core/fusion') as any;
      const PM = fusionMod.OpenSpaceProcessManager;
      if (!PM) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const pm = new PM();
      const result = await pm.healthCheck(processId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:list-profiles', async () => {
    try {
      const fusionMod = await import('@codepilot/core/fusion') as any;
      const PM = fusionMod.OpenSpaceProcessManager;
      if (!PM) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const pm = new PM();
      const profiles = await pm.listProfiles();
      return { success: true, data: profiles };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.on('openspace:subscribe-events', () => {
  });
}
