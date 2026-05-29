import { ipcMain, BrowserWindow } from 'electron';
import { PipelineService } from './pipeline-service.js';

const services = new Map<string, PipelineService>();

function getService(projectPath: string): PipelineService {
  if (!services.has(projectPath)) services.set(projectPath, new PipelineService(projectPath));
  return services.get(projectPath)!;
}

/** 获取或创建 PipelineService，并返回其引用（供 main.ts 初始化用） */
export function getOrCreateService(projectPath: string): PipelineService {
  if (!services.has(projectPath)) {
    const svc = new PipelineService(projectPath);
    services.set(projectPath, svc);
  }
  return services.get(projectPath)!;
}

/** 释放指定工作区的 PipelineService（切换工作区时使用） */
export function disposeService(projectPath: string): void {
  const svc = services.get(projectPath);
  if (svc) {
    svc.dispose();
    services.delete(projectPath);
    console.log(`[Pipeline] Disposed service for: ${projectPath}`);
  }
}

/** 获取已存在的服务（不会自动创建） */
export function getExistingService(projectPath: string): PipelineService | undefined {
  return services.get(projectPath);
}

/** 获取所有活跃的 PipelineService */
export function getAllServices(): PipelineService[] {
  return Array.from(services.values());
}

export function registerPipelineIPC(mainWindow?: BrowserWindow): void {
  // ── Pipeline CRUD ──
  ipcMain.handle('pipeline:list', async (_e, projectPath: string) => {
    try {
      return await getService(projectPath).listPipelines();
    } catch (err: any) {
      return [];
    }
  });

  ipcMain.handle('pipeline:get', async (_e, projectPath: string, id: string) => {
    try {
      const list = await getService(projectPath).listPipelines();
      return list.find((p: any) => p.id === id) || null;
    } catch (err: any) {
      return null;
    }
  });

  ipcMain.handle('pipeline:save', async (_e, projectPath: string, definition: any) => {
    try {
      if (!definition) {
        return { success: false, error: 'definition is required' };
      }
      if (!definition.id) {
        definition.id = `pipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
      if (!definition.name) {
        definition.name = definition.id;
      }
      await getService(projectPath).savePipeline(definition);
      return { success: true, id: definition.id };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('pipeline:delete', async (_e, projectPath: string, id: string) => {
    try {
      await getService(projectPath).deletePipeline(id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  // ── Pipeline Execution ──
  ipcMain.handle('pipeline:trigger', async (_e, projectPath: string, pipelineId: string, triggerType?: string) => {
    try {
      const validTrigger = ['manual', 'push', 'cron', 'watch'].includes(triggerType || '') ? triggerType : 'manual';
      const run = await getService(projectPath).triggerPipeline(pipelineId, validTrigger as any);
      // 通知渲染进程（同时兼容旧 trigger:fired API）
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pipeline:run-started', {
          pipelineId,
          runId: run.id,
          status: run.status,
          triggerType: validTrigger,
        });
        mainWindow.webContents.send('trigger:fired', {
          triggerId: pipelineId,
          data: { runId: run.id, triggerType: validTrigger, status: run.status },
        });
      }
      return run;
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('pipeline:cancel', async (_e, projectPath: string, runId: string) => {
    try {
      await getService(projectPath).cancelPipeline(runId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  // ── Run History ──
  ipcMain.handle('pipeline:runHistory', async (_e, projectPath: string, pipelineId: string, limit?: number) => {
    try {
      return await getService(projectPath).getRunHistory(pipelineId, limit);
    } catch (err: any) {
      return [];
    }
  });

  ipcMain.handle('pipeline:runDetail', async (_e, projectPath: string, runId: string) => {
    try {
      return await getService(projectPath).getRunDetail(runId);
    } catch (err: any) {
      return null;
    }
  });

  // ── Watch / File Monitor ──
  ipcMain.handle('pipeline:watchStatus', async (_e, projectPath: string) => {
    try {
      return getService(projectPath).getWatchStatus();
    } catch (err: any) {
      return [];
    }
  });

  ipcMain.handle('pipeline:autoLoad', async (_e, projectPath: string) => {
    try {
      const definitions = await getService(projectPath).autoLoadPipelines();
      return { success: true, count: definitions.length };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });
}
