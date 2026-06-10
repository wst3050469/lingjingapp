import type { BrowserWindow } from 'electron';

let _mainWindow: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow | null): void {
  _mainWindow = win;
}

export function sendToRenderer(channel: string, ...args: any[]): boolean {
  if (!_mainWindow) {
    return false;
  }
  try {
    if (_mainWindow.isDestroyed()) {
      return false;
    }
    _mainWindow.webContents.send(channel, ...args);
    return true;
  } catch (err: any) {
    console.warn(`[ipc-safe] Failed to send '${channel}': ${err?.message ?? err}`);
    return false;
  }
}