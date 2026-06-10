// @ts-nocheck - TriggerManager API has changed; this file uses old methods
import { IpcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { TriggerManager } from '@codepilot/core';
import { TriggerConfig, TriggerStatus } from '@codepilot/core';

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
    event: IpcMainInvokeEvent,
    type: string,
    config: TriggerConfig
  ): Promise<{ success: boolean; triggerId?: string; error?: string }> {
    try {
      const triggerId = await this.manager.registerTrigger(type, config);
      return { success: true, triggerId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleUpdate(
    event: IpcMainInvokeEvent,
    triggerId: string,
    config: Partial<TriggerConfig>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.manager.updateTrigger(triggerId, config);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleDelete(
    event: IpcMainInvokeEvent,
    triggerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.manager.unregisterTrigger(triggerId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleEnable(
    event: IpcMainInvokeEvent,
    triggerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.manager.enableTrigger(triggerId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleDisable(
    event: IpcMainInvokeEvent,
    triggerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.manager.disableTrigger(triggerId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleGetStatus(
    event: IpcMainInvokeEvent,
    triggerId: string
  ): Promise<TriggerStatus | null> {
    return this.manager.getTriggerStatus(triggerId);
  }

  private async handleList(
    event: IpcMainInvokeEvent
  ): Promise<Array<{ id: string; type: string; status: TriggerStatus }>> {
    return this.manager.listTriggers();
  }

  private async handleGetConfig(
    event: IpcMainInvokeEvent,
    triggerId: string
  ): Promise<TriggerConfig | null> {
    return this.manager.getTriggerConfig(triggerId);
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
