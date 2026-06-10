import { ipcMain } from 'electron';
import { QuestStateManager, QuestAgentState } from '../services/quest-state-manager';
import { createLogger } from '../monitoring/logger';

const logger = createLogger('quest-state-ipc');
const stateManager = new QuestStateManager();

export function registerQuestStateIpc(): void {
  ipcMain.handle('quest-state:save', async (_event, state: QuestAgentState) => {
    try {
      await stateManager.saveState(state);
      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save quest state', err, { taskId: state.taskId });
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quest-state:load', async (_event, { taskId }: { taskId: string }) => {
    try {
      const state = await stateManager.loadState(taskId);
      return { success: true, state };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to load quest state', err, { taskId });
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quest-state:delete', async (_event, { taskId }: { taskId: string }) => {
    try {
      await stateManager.deleteState(taskId);
      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to delete quest state', err, { taskId });
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quest-state:get-all', async () => {
    try {
      const states = await stateManager.getAllStates();
      return { success: true, states };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get all quest states', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quest-state:update', async (
    _event,
    { taskId, updates }: { taskId: string; updates: Partial<QuestAgentState> }
  ) => {
    try {
      const state = await stateManager.updateState(taskId, updates);
      return { success: true, state };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update quest state', err, { taskId });
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quest-state:create-checkpoint', async (
    _event,
    { taskId, step, data }: { taskId: string; step: number; data?: any }
  ) => {
    try {
      await stateManager.createCheckpoint(taskId, step, data);
      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create checkpoint', err, { taskId, step });
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quest-state:restore-checkpoint', async (
    _event,
    { taskId }: { taskId: string }
  ) => {
    try {
      const state = await stateManager.restoreFromCheckpoint(taskId);
      return { success: true, state };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to restore checkpoint', err, { taskId });
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quest-state:get-by-status', async (
    _event,
    { status }: { status: QuestAgentState['status'] }
  ) => {
    try {
      const states = await stateManager.getStatesByStatus(status);
      return { success: true, states };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get states by status', err, { status });
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quest-state:cleanup', async (
    _event,
    { olderThan }: { olderThan?: number }
  ) => {
    try {
      const cleaned = await stateManager.cleanup(olderThan);
      return { success: true, cleaned };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to cleanup states', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quest-state:get-cache-stats', async () => {
    try {
      const stats = stateManager.getCacheStats();
      return { success: true, stats };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get cache stats', err);
      return { success: false, error: err.message };
    }
  });

  logger.info('Quest state IPC handlers registered');
}

export { stateManager as questStateManager };
