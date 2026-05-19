import { IpcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { WorkflowEngine } from '../../../core/src/workflow/core/workflow-engine';
import { 
  WorkflowRequirement, 
  ProgressInfo,
  WorkflowState,
  WorkflowStatus 
} from '../../../core/src/workflow/types';

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
    this.ipcMain.handle('workflow:getHistory', this.handleGetHistory.bind(this));
    this.ipcMain.handle('workflow:getDocument', this.handleGetDocument.bind(this));
    this.ipcMain.handle('workflow:list', this.handleList.bind(this));
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
    event: IpcMainInvokeEvent,
    workflowId?: string
  ): Promise<{ runningCount: number; batchProgress: string | null }> {
    try {
      const workflows = await this.engine.listWorkflows();
      const runningCount = workflows.filter(
        w => w.status === WorkflowStatus.RUNNING || w.status === WorkflowStatus.PAUSED
      ).length;
      return { runningCount, batchProgress: null };
    } catch {
      return { runningCount: 0, batchProgress: null };
    }
  }

  private async handleGetHistory(
    event: IpcMainInvokeEvent,
    workflowId: string,
    limit?: number
  ): Promise<any[]> {
    return [];
  }

  private async handleGetDocument(
    event: IpcMainInvokeEvent,
    docType: string,
    featureName: string
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      return { success: true, content: '' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleList(
    event: IpcMainInvokeEvent
  ): Promise<any[]> {
    return [];
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

/**
 * Simplified registration that creates a WorkflowEngine from a database instance.
 * Call this from main.ts to avoid needing to import WorkflowEngine directly.
 */
export function registerWorkflowIPCWithDb(ipcMain: IpcMain, db: any): WorkflowIPCHandler {
  const engine = new WorkflowEngine(db);
  return registerWorkflowIPC(ipcMain, engine);
}
