import { ipcMain } from 'electron';
import type { IHookRegistry, HookPoint } from '../../../core/src/fusion/hook-registry/types.js';

let hookRegistry: IHookRegistry | null = null;

export function setHookRegistry(registry: IHookRegistry): void {
  hookRegistry = registry;
}

export function registerHookIpc(): void {
  ipcMain.handle('fusion:hook:list', async () => {
    if (!hookRegistry) return { success: false, error: 'HookRegistry not initialized' };
    const health = hookRegistry.healthCheck();
    return { success: true, hookCount: health.hookCount };
  });

  ipcMain.handle('fusion:hook:unregister', async (_event, id: string) => {
    if (!hookRegistry) return { success: false, error: 'HookRegistry not initialized' };
    const result = hookRegistry.unregister(id);
    return { success: result };
  });
}
