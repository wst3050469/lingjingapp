/**
 * OpenSpace IPC Registration
 *
 * Registers IPC handlers for the OpenSpace Fusion subsystem,
 * enabling renderer-to-main communication for OpenSpace process
 * management, script execution, and data synchronization.
 */

import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';

export function registerOpenSpaceIPC(mainWindow: BrowserWindow): void {
  ipcMain.handle('openspace:start', async (_event, config) => {
    try {
      const { OpenSpaceProcessManager } = await import(
        '@codepilot/core/fusion/openspace/process-manager.js'
      );
      const pm = new OpenSpaceProcessManager();
      const result = await pm.start(config);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:stop', async (_event, processId) => {
    try {
      const { OpenSpaceProcessManager } = await import(
        '@codepilot/core/fusion/openspace/process-manager.js'
      );
      const pm = new OpenSpaceProcessManager();
      await pm.stop(processId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:execute-script', async (_event, request) => {
    try {
      const { OpenSpaceFusionAdapter } = await import(
        '@codepilot/core/fusion/openspace/fusion-adapter.js'
      );
      const adapter = new OpenSpaceFusionAdapter();
      const result = await adapter.executeScript(request);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:health-check', async (_event, processId) => {
    try {
      const { OpenSpaceProcessManager } = await import(
        '@codepilot/core/fusion/openspace/process-manager.js'
      );
      const pm = new OpenSpaceProcessManager();
      const result = await pm.healthCheck(processId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:list-profiles', async () => {
    try {
      const { OpenSpaceProcessManager } = await import(
        '@codepilot/core/fusion/openspace/process-manager.js'
      );
      const pm = new OpenSpaceProcessManager();
      const profiles = await pm.listProfiles();
      return { success: true, data: profiles };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.on('openspace:subscribe-events', () => {
    // Bridge will be connected when process starts
  });
}
