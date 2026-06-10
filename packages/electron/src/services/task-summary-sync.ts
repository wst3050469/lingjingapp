import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { webSocketGateway } from './websocket-gateway.js';
import { taskSummaryGenerator } from './task-summary-generator.js';
import type { TaskSummary } from '../db/types/ide-enhance-types.js';

const logger = createLogger('task-summary-sync');

export class TaskSummarySync extends EventEmitter {
  private subscriptions = new Map<string, Set<string>>();

  subscribeUpdates(sessionId: string, deviceId: string): void {
    const subs = this.subscriptions.get(sessionId) ?? new Set();
    subs.add(deviceId);
    this.subscriptions.set(sessionId, subs);
    logger.info('Task summary subscribed', { sessionId, deviceId });
  }

  onStepComplete(sessionId: string, events: Array<{ type: string; data?: any }>, taskTitle?: string): void {
    const summary = taskSummaryGenerator.generate(events, sessionId, taskTitle);
    webSocketGateway.broadcastToMobile({
      type: 'push',
      channel: 'task-summary',
      event: 'update',
      data: summary,
    });
    this.emit('summary-updated', summary);
  }
}

export const taskSummarySync = new TaskSummarySync();