import { IpcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
// @ts-ignore
import { BatchTaskQueue } from '@codepilot/core';
// @ts-ignore
import { BatchExecutor } from '@codepilot/core';
// @ts-ignore - not in exports
import type { BatchTask, BatchTaskStatus, BatchResult } from '@codepilot/core';

export class BatchIPCHandler {
  private ipcMain: IpcMain;
  private taskQueue: BatchTaskQueue;
  private executor: BatchExecutor;

  constructor(ipcMain: IpcMain, taskQueue: BatchTaskQueue, executor: BatchExecutor) {
    this.ipcMain = ipcMain;
    this.taskQueue = taskQueue;
    this.executor = executor;
  }

  registerHandlers(): void {
    this.ipcMain.handle('batch:submit', this.handleSubmit.bind(this));
    this.ipcMain.handle('batch:cancel', this.handleCancel.bind(this));
    this.ipcMain.handle('batch:getProgress', this.handleGetProgress.bind(this));
    this.ipcMain.handle('batch:getResult', this.handleGetResult.bind(this));
    this.ipcMain.handle('batch:list', this.handleList.bind(this));
    this.ipcMain.handle('batch:getTask', this.handleGetTask.bind(this));
    this.ipcMain.handle('batch:pause', this.handlePause.bind(this));
    this.ipcMain.handle('batch:resume', this.handleResume.bind(this));
  }

  private async handleSubmit(
    event: IpcMainInvokeEvent,
    tasks: BatchTask[]
  ): Promise<{ success: boolean; taskIds?: string[]; error?: string }> {
    try {
      const taskIds = await this.taskQueue.enqueueBatch(tasks);
      return { success: true, taskIds };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleCancel(
    event: IpcMainInvokeEvent,
    taskId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.taskQueue.cancelTask(taskId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleGetProgress(
    event: IpcMainInvokeEvent,
    taskId: string
  ): Promise<{ total: number; completed: number; failed: number; pending: number } | null> {
    return this.executor.getProgress(taskId);
  }

  private async handleGetResult(
    event: IpcMainInvokeEvent,
    taskId: string
  ): Promise<BatchResult | null> {
    return this.executor.getResult(taskId);
  }

  private async handleList(
    event: IpcMainInvokeEvent,
    status?: BatchTaskStatus
  ): Promise<BatchTask[]> {
    return this.taskQueue.listTasks(status);
  }

  private async handleGetTask(
    event: IpcMainInvokeEvent,
    taskId: string
  ): Promise<BatchTask | null> {
    return this.taskQueue.getTask(taskId);
  }

  private async handlePause(
    event: IpcMainInvokeEvent,
    taskId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.executor.pause(taskId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async handleResume(
    event: IpcMainInvokeEvent,
    taskId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.executor.resume(taskId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  notifyProgress(taskId: string, progress: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('batch:progress', { taskId, ...progress });
    });
  }

  notifyComplete(taskId: string, result: BatchResult): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('batch:complete', { taskId, result });
    });
  }

  notifyError(taskId: string, error: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('batch:error', { taskId, error });
    });
  }

  notifyTaskStatusChange(taskId: string, status: BatchTaskStatus): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('batch:statusChange', { taskId, status });
    });
  }
}

export function registerBatchIPC(
  ipcMain: IpcMain,
  taskQueue: BatchTaskQueue,
  executor: BatchExecutor
): BatchIPCHandler {
  const handler = new BatchIPCHandler(ipcMain, taskQueue, executor);
  handler.registerHandlers();
  return handler;
}
