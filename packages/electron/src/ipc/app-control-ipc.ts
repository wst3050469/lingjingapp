import { ipcMain } from 'electron';
import { createAppController, IAppController } from '../services/app-controller/index.js';

let appController: IAppController | null = null;

function getAppController(): IAppController {
  if (!appController) {
    appController = createAppController();
  }
  return appController;
}

export function registerAppControlIpc(): void {
  ipcMain.handle('app-control:get-installed-apps', async () => {
    try {
      const controller = getAppController();
      const apps = await controller.getInstalledApps();
      return { success: true, data: apps };
    } catch (error: any) {
      console.error('[AppControl] getInstalledApps error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app-control:get-windows', async () => {
    try {
      const controller = getAppController();
      const windows = await controller.getWindows();
      return { success: true, data: windows };
    } catch (error: any) {
      console.error('[AppControl] getWindows error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app-control:launch-app', async (_event, appName: string, args?: string[]) => {
    try {
      const controller = getAppController();
      const result = await controller.launchApp(appName, args);
      return { success: result };
    } catch (error: any) {
      console.error('[AppControl] launchApp error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app-control:close-app', async (_event, appName: string) => {
    try {
      const controller = getAppController();
      const result = await controller.closeApp(appName);
      return { success: result };
    } catch (error: any) {
      console.error('[AppControl] closeApp error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app-control:focus-window', async (_event, title: string) => {
    try {
      const controller = getAppController();
      const result = await controller.focusWindow(title);
      return { success: result };
    } catch (error: any) {
      console.error('[AppControl] focusWindow error:', error);
      return { success: false, error: error.message };
    }
  });
}
