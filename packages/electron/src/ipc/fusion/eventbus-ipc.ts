import { ipcMain } from 'electron';
import type { IEventBus } from '@codepilot/core/fusion';

let eventBus: IEventBus | null = null;

export function setEventBus(bus: IEventBus): void {
  eventBus = bus;
}

export function registerEventBusIpc(): void {
  ipcMain.handle('fusion:eventbus:publish', async (_event, topic: string, data: unknown, source: string) => {
    if (!eventBus) return { success: false, error: 'EventBus not initialized' };
    eventBus.publish(topic as any, data, source);
    return { success: true };
  });

  ipcMain.handle('fusion:eventbus:subscribe', async (_event, topic: string) => {
    if (!eventBus) return { success: false, error: 'EventBus not initialized' };
    return { success: true, message: 'Subscription registered (renderer side should manage callbacks)' };
  });

  ipcMain.handle('fusion:eventbus:metrics', async () => {
    if (!eventBus) return { success: false, error: 'EventBus not initialized' };
    return { success: true, metrics: eventBus.healthCheck().metrics };
  });
}
