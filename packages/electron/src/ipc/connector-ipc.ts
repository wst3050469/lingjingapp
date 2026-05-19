import { IpcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
// @ts-ignore
import { ConnectorManager } from '@codepilot/core';
// @ts-ignore
import { BaseConnector, ConnectorConfig, ConnectorStatus } from '@codepilot/core';

export class ConnectorIPCHandler {
  private ipcMain: IpcMain;
  private manager: ConnectorManager;

  constructor(ipcMain: IpcMain, manager: ConnectorManager) {
    this.ipcMain = ipcMain;
    this.manager = manager;
  }

  registerHandlers(): void {
    this.ipcMain.handle('connector:register', this.handleRegister.bind(this));
    this.ipcMain.handle('connector:unregister', this.handleUnregister.bind(this));
    this.ipcMain.handle('connector:configure', this.handleConfigure.bind(this));
    this.ipcMain.handle('connector:test', this.handleTest.bind(this));
    this.ipcMain.handle('connector:getStatus', this.handleGetStatus.bind(this));
    this.ipcMain.handle('connector:list', this.handleList.bind(this));
    this.ipcMain.handle('connector:getConfig', this.handleGetConfig.bind(this));
  }

  private async handleRegister(
    event: IpcMainInvokeEvent,
    type: string,
    config: ConnectorConfig
  ): Promise<{ success: boolean; connectorId?: string; error?: string }> {
    try {
      const connectorId = await this.manager.registerConnector(type, config);
      return { success: true, connectorId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleUnregister(
    event: IpcMainInvokeEvent,
    connectorId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.manager.unregisterConnector(connectorId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleConfigure(
    event: IpcMainInvokeEvent,
    connectorId: string,
    config: Partial<ConnectorConfig>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.manager.configureConnector(connectorId, config);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleTest(
    event: IpcMainInvokeEvent,
    connectorId: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const result = await this.manager.testConnector(connectorId);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleGetStatus(
    event: IpcMainInvokeEvent,
    connectorId: string
  ): Promise<ConnectorStatus | null> {
    return this.manager.getConnectorStatus(connectorId);
  }

  private async handleList(
    event: IpcMainInvokeEvent
  ): Promise<Array<{ id: string; type: string; status: ConnectorStatus }>> {
    return this.manager.listConnectors();
  }

  private async handleGetConfig(
    event: IpcMainInvokeEvent,
    connectorId: string
  ): Promise<ConnectorConfig | null> {
    return this.manager.getConnectorConfig(connectorId);
  }

  notifyStatusChange(connectorId: string, status: ConnectorStatus): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('connector:statusChange', { connectorId, status });
    });
  }

  notifyError(connectorId: string, error: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('connector:error', { connectorId, error });
    });
  }
}

export function registerConnectorIPC(ipcMain: IpcMain, manager: ConnectorManager): ConnectorIPCHandler {
  const handler = new ConnectorIPCHandler(ipcMain, manager);
  handler.registerHandlers();
  return handler;
}
