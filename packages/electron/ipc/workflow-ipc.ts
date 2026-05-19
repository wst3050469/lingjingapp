import { IpcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { WorkflowEngine } from '../../core/workflow/workflow-engine';
import { WorkflowRequirement, ProgressInfo } from '../../core/workflow/types';

export class WorkflowIPCHandler {
  private ipcMain: IpcMain;
  private engine: WorkflowEngine;

  constructor(ipcMain: IpcMain, engine: WorkflowEngine) {
    this.ipcMain = ipcMain;
    this.engine = engine;
  }

  registerHandlers(): void {
    this.ipcMain.handle('workflow:start', this.handleStart.bind(this));
    this.ipcMain.handle('workflow:pause', this.handlePause.bind(this));
    this.ipcMain.handle('workflow:resume', this.handleResume.bind(this));
    this.ipcMain.handle('workflow:stop', this.handleStop.bind(this));
    this.ipcMain.handle('workflow:getStatus', this.handleGetStatus.bind(this));
    this.ipcMain.handle('workflow:getDocument', this.handleGetDocument.bind(this));
  }

  private async handleStart(
    event: IpcMainInvokeEvent,
    requirement: WorkflowRequirement
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      const workflowId = await this.engine.startWorkflow(requirement);
      
      return { success: true, workflowId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handlePause(
    event: IpcMainInvokeEvent,
    workflowId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.engine.pauseWorkflow();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleResume(
    event: IpcMainInvokeEvent,
    workflowId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.engine.resumeWorkflow();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleStop(
    event: IpcMainInvokeEvent,
    workflowId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.engine.stopWorkflow();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleGetStatus(
    event: IpcMainInvokeEvent
  ): Promise<any> {
    return this.engine.getStatus();
  }

  private async handleGetDocument(
    event: IpcMainInvokeEvent,
    docType: string,
    featureName: string
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const documentManager = this.engine['documentManager'];
      const content = await documentManager.readDocument(
        `${docType}.md`,
        featureName
      );
      
      return { success: true, content };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  notifyProgress(progress: ProgressInfo): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('workflow:progress', progress);
    });
  }

  notifyPhaseChange(workflowId: string, phaseInfo: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('workflow:phaseChange', { workflowId, ...phaseInfo });
    });
  }

  notifyError(workflowId: string, error: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('workflow:error', { workflowId, error });
    });
  }

  notifyLog(workflowId: string, log: string): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('workflow:log', { workflowId, log });
    });
  }
}

export function registerWorkflowIPC(ipcMain: IpcMain, engine: WorkflowEngine): WorkflowIPCHandler {
  const handler = new WorkflowIPCHandler(ipcMain, engine);
  handler.registerHandlers();
  return handler;
}
