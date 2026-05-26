import { IpcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { TriggerManager } from '@codepilot/core';
import type { PipelineDefinition } from '@codepilot/core';

// ⚠️ TriggerConfig / TriggerStatus are from workflow types (awaiting pipeline integration)
// These IPC handlers expose CRUD operations for triggers; currently stubbed
// because TriggerManager only supports registerPushTrigger / registerCronTrigger / registerAll / dispose.

interface TriggerConfig {
  id?: string;
  type: string;
  name: string;
  branches?: string[];
  expression?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

type TriggerStatus = 'active' | 'inactive' | 'error';

export class TriggerIPCHandler {
  private ipcMain: IpcMain;
  private manager: TriggerManager;

  constructor(ipcMain: IpcMain, manager: TriggerManager) {
    this.ipcMain = ipcMain;
    this.manager = manager;
  }

  registerHandlers(): void {
    this.ipcMain.handle('trigger:create', this.handleCreate.bind(this));
    this.ipcMain.handle('trigger:update', this.handleUpdate.bind(this));
    this.ipcMain.handle('trigger:delete', this.handleDelete.bind(this));
    this.ipcMain.handle('trigger:enable', this.handleEnable.bind(this));
    this.ipcMain.handle('trigger:disable', this.handleDisable.bind(this));
    this.ipcMain.handle('trigger:getStatus', this.handleGetStatus.bind(this));
    this.ipcMain.handle('trigger:list', this.handleList.bind(this));
    this.ipcMain.handle('trigger:getConfig', this.handleGetConfig.bind(this));
  }

  private async handleCreate(
    _event: IpcMainInvokeEvent,
    type: string,
    config: TriggerConfig,
  ): Promise<{ success: boolean; triggerId?: string; error?: string }> {
    try {
      // NOTE: TriggerManager doesn't yet support dynamic trigger registration.
      // This is a forward-looking API. When implemented, register via registerAll().
      const def: PipelineDefinition = {
        id: config.id || `trigger_${Date.now()}`,
        name: config.name || type,
        triggers: [{ type: type as 'push' | 'cron', branches: config.branches, expression: config.expression }],
        stages: [],
      };
      this.manager.registerAll(def);
      return { success: true, triggerId: def.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleUpdate(
    _event: IpcMainInvokeEvent,
    _triggerId: string,
    _config: Partial<TriggerConfig>,
  ): Promise<{ success: boolean; error?: string }> {
    // Stub: TriggerManager doesn't support update. Dispose + re-register pattern would be needed.
    return { success: false, error: 'Trigger update not yet supported by the pipeline engine' };
  }

  private async handleDelete(
    _event: IpcMainInvokeEvent,
    _triggerId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Stub: Call dispose() to clean up all triggers.
    this.manager.dispose();
    return { success: true };
  }

  private async handleEnable(
    _event: IpcMainInvokeEvent,
    _triggerId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Trigger enable/disable not yet supported by the pipeline engine' };
  }

  private async handleDisable(
    _event: IpcMainInvokeEvent,
    _triggerId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Trigger enable/disable not yet supported by the pipeline engine' };
  }

  private async handleGetStatus(
    _event: IpcMainInvokeEvent,
    _triggerId: string,
  ): Promise<TriggerStatus | null> {
    return null; // Stub
  }

  private async handleList(
    _event: IpcMainInvokeEvent,
  ): Promise<Array<{ id: string; type: string; status: TriggerStatus }>> {
    return []; // Stub
  }

  private async handleGetConfig(
    _event: IpcMainInvokeEvent,
    _triggerId: string,
  ): Promise<TriggerConfig | null> {
    return null; // Stub
  }

  notifyTrigger(triggerId: string, data: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('trigger:fired', { triggerId, data });
    });
  }

  notifyStatusChange(triggerId: string, status: TriggerStatus): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('trigger:statusChange', { triggerId, status });
    });
  }

  notifyError(triggerId: string, error: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('trigger:error', { triggerId, error });
    });
  }
}

export function registerTriggerIPC(ipcMain: IpcMain, manager: TriggerManager): TriggerIPCHandler {
  const handler = new TriggerIPCHandler(ipcMain, manager);
  handler.registerHandlers();
  return handler;
}
