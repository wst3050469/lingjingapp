import { ipcMain } from 'electron';
import { createAppController, IAppController } from '../services/app-controller/index.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

let appController: IAppController | null = null;

function getAppController(): IAppController {
  if (!appController) {
    appController = createAppController();
  }
  return appController;
}

async function checkDesktopControlEnabled(): Promise<boolean> {
  try {
    const cfgPath = join(homedir(), '.lingjing', 'config.json');
    const raw = await readFile(cfgPath, 'utf8');
    const cfg = JSON.parse(raw);
    const adv = cfg.advanced as Record<string, unknown> | undefined;
    return !!(adv?.desktopControlEnabled);
  } catch {
    return false;
  }
}

export function registerAppControlIpc(): void {
  ipcMain.handle('app-control:get-installed-apps', async () => {
    if (!(await checkDesktopControlEnabled())) {
      return { success: false, error: '桌面控制权限未开启，请在 设置→高级→鼠标键盘操控权限 中开启' };
    }
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
    if (!(await checkDesktopControlEnabled())) {
      return { success: false, error: '桌面控制权限未开启，请在 设置→高级→鼠标键盘操控权限 中开启' };
    }
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
    if (!(await checkDesktopControlEnabled())) {
      return { success: false, error: '桌面控制权限未开启，请在 设置→高级→鼠标键盘操控权限 中开启' };
    }
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
    if (!(await checkDesktopControlEnabled())) {
      return { success: false, error: '桌面控制权限未开启，请在 设置→高级→鼠标键盘操控权限 中开启' };
    }
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
    if (!(await checkDesktopControlEnabled())) {
      return { success: false, error: '桌面控制权限未开启，请在 设置→高级→鼠标键盘操控权限 中开启' };
    }
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
