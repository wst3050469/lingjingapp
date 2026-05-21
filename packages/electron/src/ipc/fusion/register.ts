import type { BrowserWindow } from 'electron';
import { registerEventBusIpc } from './eventbus-ipc.js';
import { registerHookIpc } from './hook-ipc.js';
import { registerFusionModuleIpc } from './fusion-module-ipc.js';
import { registerOpenSpaceIPC } from './openspace-register.js';

export function registerFusionIPC(mainWindow: BrowserWindow): void {
  registerEventBusIpc();
  registerHookIpc();
  registerFusionModuleIpc();
  registerOpenSpaceIPC(mainWindow);
}
