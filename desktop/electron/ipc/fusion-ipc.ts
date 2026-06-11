import { IpcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { EventBus, HookRegistry, IEventBus, IHookRegistry } from '@codepilot/core';

export class FusionIPCHandler {
  private ipcMain: IpcMain;
  private eventBus: IEventBus;
  private hookRegistry: IHookRegistry;
  private windows: Set<BrowserWindow> = new Set();

  constructor(ipcMain: IpcMain, eventBus: IEventBus, hookRegistry: IHookRegistry) {
    this.ipcMain = ipcMain;
    this.eventBus = eventBus;
    this.hookRegistry = hookRegistry;
  }

  registerHandlers(): void {
    // EventBus IPC
    this.ipcMain.handle('fusion:eventbus:publish', this.handleEventBusPublish.bind(this));
    this.ipcMain.handle('fusion:eventbus:subscribe', this.handleEventBusSubscribe.bind(this));
    this.ipcMain.handle('fusion:eventbus:unsubscribe', this.handleEventBusUnsubscribe.bind(this));
    this.ipcMain.handle('fusion:eventbus:health', this.handleEventBusHealth.bind(this));

    // HookRegistry IPC
    this.ipcMain.handle('fusion:hook:register', this.handleHookRegister.bind(this));
    this.ipcMain.handle('fusion:hook:unregister', this.handleHookUnregister.bind(this));
    this.ipcMain.handle('fusion:hook:execute', this.handleHookExecute.bind(this));
    this.ipcMain.handle('fusion:hook:health', this.handleHookHealth.bind(this));

    // Module status IPC
    this.ipcMain.handle('fusion:modules:status', this.handleModulesStatus.bind(this));
  }

  trackWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on('closed', () => this.windows.delete(win));
  }

  private async handleEventBusPublish(
    _event: IpcMainInvokeEvent,
    params: { topic: string; data: unknown; source: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.eventBus.publish(params.topic as any, params.data, params.source);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async handleEventBusSubscribe(
    event: IpcMainInvokeEvent,
    params: { topic: string; handlerId: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const unsub = this.eventBus.subscribe(
        params.topic as any,
        (msg) => {
          const win = BrowserWindow.fromWebContents(event.sender);
          if (win && !win.isDestroyed()) {
            win.webContents.send('fusion:eventbus:event', {
              handlerId: params.handlerId,
              event: msg,
            });
          }
        }
      );
      this.activeSubscriptions.set(params.handlerId, unsub);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async handleEventBusUnsubscribe(
    _event: IpcMainInvokeEvent,
    params: { handlerId: string }
  ): Promise<{ success: boolean }> {
    const unsub = this.activeSubscriptions.get(params.handlerId);
    if (unsub) {
      unsub();
      this.activeSubscriptions.delete(params.handlerId);
    }
    return { success: true };
  }

  private async handleEventBusHealth(): Promise<{ healthy: boolean; metrics: any }> {
    return this.eventBus.healthCheck();
  }

  private async handleHookRegister(
    _event: IpcMainInvokeEvent,
    params: { point: string; priority?: number }
  ): Promise<{ success: boolean; hookId?: string; error?: string }> {
    try {
      const hookId = this.hookRegistry.register(
        params.point as any,
        async (ctx) => {
          // Forward to renderer
          return ctx;
        },
        { priority: params.priority }
      );
      return { success: true, hookId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async handleHookUnregister(
    _event: IpcMainInvokeEvent,
    params: { hookId: string }
  ): Promise<{ success: boolean }> {
    return { success: this.hookRegistry.unregister(params.hookId) };
  }

  private async handleHookExecute(
    _event: IpcMainInvokeEvent,
    params: { point: string; data: unknown }
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const context = await this.hookRegistry.execute(params.point as any, params.data);
      return { success: true, data: context.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async handleHookHealth(): Promise<{ healthy: boolean; hookCount: number }> {
    return this.hookRegistry.healthCheck();
  }

  private async handleModulesStatus(): Promise<Record<string, any>> {
    const ebHealth = this.eventBus.healthCheck();
    const hrHealth = this.hookRegistry.healthCheck();
    return {
      eventBus: ebHealth,
      hookRegistry: hrHealth,
      timestamp: Date.now(),
    };
  }

  private activeSubscriptions = new Map<string, () => void>();
}
