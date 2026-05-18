import type { BrowserWindow } from 'electron';
import { registerEventBusIpc } from './eventbus-ipc.js';
import { registerHookIpc } from './hook-ipc.js';
import { registerFusionModuleIpc } from './fusion-module-ipc.js';

export function registerFusionIPC(_mainWindow: BrowserWindow): void {
  registerEventBusIpc();
  registerHookIpc();
  registerFusionModuleIpc();
}
