import { createLogger } from '../monitoring/logger';
import { QuestStateManager, QuestAgentState } from '../services/quest-state-manager';

const logger = createLogger('quest-module');

export interface QuestTask {
  id: string;
  title: string;
  status: QuestAgentState['status'];
  createdAt: number;
  updatedAt: number;
  progress?: number;
  error?: string;
}

export interface QuestConversation {
  taskId: string;
  messages: any[];
  totalTokens: number;
  lastMessageAt: number;
}

export interface QuestFilter {
  status?: QuestAgentState['status'];
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

export interface QuestStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export class QuestModule {
  private stateManager: QuestStateManager;

  constructor() {
    this.stateManager = new QuestStateManager();
  }

  async listTasks(filter?: QuestFilter): Promise<QuestTask[]> {
    let states = await this.stateManager.getAllStates();

    if (filter?.status) {
      states = states.filter(s => s.status === filter.status);
    }

    if (filter?.from) {
      states = states.filter(s => s.createdAt >= filter.from!);
    }

    if (filter?.to) {
      states = states.filter(s => s.createdAt <= filter.to!);
    }

    const tasks: QuestTask[] = states.map(state => ({
      id: state.taskId,
      title: state.metadata?.title || `Task ${state.taskId}`,
      status: state.status,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      progress: state.checkpoint?.step,
      error: state.error
    }));

    if (filter?.offset !== undefined) {
      tasks.splice(0, filter.offset);
    }

    if (filter?.limit !== undefined) {
      tasks.splice(filter.limit);
    }

    return tasks;
  }

  async getTask(taskId: string): Promise<QuestTask | null> {
    const state = await this.stateManager.loadState(taskId);

    if (!state) {
      return null;
    }

    return {
      id: state.taskId,
      title: state.metadata?.title || `Task ${state.taskId}`,
      status: state.status,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      progress: state.checkpoint?.step,
      error: state.error
    };
  }

  async getConversation(taskId: string): Promise<QuestConversation | null> {
    const state = await this.stateManager.loadState(taskId);

    if (!state || !state.conversation) {
      return null;
    }

    return {
      taskId,
      messages: state.conversation.messages || [],
      totalTokens: state.conversation.totalTokens || 0,
      lastMessageAt: state.updatedAt
    };
  }

  async getStats(): Promise<QuestStats> {
    const states = await this.stateManager.getAllStates();

    return {
      total: states.length,
      running: states.filter(s => s.status === 'running').length,
      completed: states.filter(s => s.status === 'completed').length,
      failed: states.filter(s => s.status === 'failed').length,
      cancelled: states.filter(s => s.status === 'cancelled').length
    };
  }

  async pauseTask(taskId: string): Promise<{ success: boolean; message: string }> {
    logger.info('Pausing task', { taskId });

    const state = await this.stateManager.loadState(taskId);
    if (!state) {
      return { success: false, message: 'Task not found' };
    }

    if (state.status !== 'running') {
      return { success: false, message: 'Task is not running' };
    }

    await this.stateManager.updateState(taskId, { status: 'paused' });

    return { success: true, message: 'Task paused' };
  }

  async resumeTask(taskId: string): Promise<{ success: boolean; message: string }> {
    logger.info('Resuming task', { taskId });

    const state = await this.stateManager.loadState(taskId);
    if (!state) {
      return { success: false, message: 'Task not found' };
    }

    if (state.status !== 'paused') {
      return { success: false, message: 'Task is not paused' };
    }

    await this.stateManager.updateState(taskId, { status: 'running' });

    return { success: true, message: 'Task resumed' };
  }

  async cancelTask(taskId: string): Promise<{ success: boolean; message: string }> {
    logger.info('Cancelling task', { taskId });

    const state = await this.stateManager.loadState(taskId);
    if (!state) {
      return { success: false, message: 'Task not found' };
    }

    await this.stateManager.updateState(taskId, { status: 'cancelled' });

    return { success: true, message: 'Task cancelled' };
  }

  async retryTask(taskId: string): Promise<{ success: boolean; message: string }> {
    logger.info('Retrying task', { taskId });

    const state = await this.stateManager.loadState(taskId);
    if (!state) {
      return { success: false, message: 'Task not found' };
    }

    if (state.status !== 'failed') {
      return { success: false, message: 'Only failed tasks can be retried' };
    }

    await this.stateManager.updateState(taskId, {
      status: 'running',
      error: undefined
    });

    return { success: true, message: 'Task retry initiated' };
  }

  async deleteTask(taskId: string): Promise<{ success: boolean; message: string }> {
    logger.info('Deleting task', { taskId });

    await this.stateManager.deleteState(taskId);

    return { success: true, message: 'Task deleted' };
  }

  async exportTask(taskId: string): Promise<any> {
    const state = await this.stateManager.loadState(taskId);

    if (!state) {
      return null;
    }

    return {
      ...state,
      exportedAt: Date.now()
    };
  }

  async importTask(data: any): Promise<{ success: boolean; taskId: string }> {
    const state: QuestAgentState = {
      taskId: data.taskId || `imported-${Date.now()}`,
      status: data.status || 'idle',
      createdAt: data.createdAt || Date.now(),
      updatedAt: Date.now(),
      conversation: data.conversation,
      context: data.context,
      metadata: data.metadata
    };

    await this.stateManager.saveState(state);

    return { success: true, taskId: state.taskId };
  }

  async searchTasks(query: string): Promise<QuestTask[]> {
    const allTasks = await this.listTasks();
    const lowerQuery = query.toLowerCase();

    return allTasks.filter(task =>
      task.title.toLowerCase().includes(lowerQuery) ||
      task.id.toLowerCase().includes(lowerQuery)
    );
  }

  async cleanup(olderThanDays: number = 7): Promise<{ deleted: number }> {
    const threshold = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const deleted = await this.stateManager.cleanup(threshold);

    return { deleted };
  }
}

export const questModule = new QuestModule();
