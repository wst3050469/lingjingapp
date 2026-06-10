import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import type { TaskSummary } from '../db/types/ide-enhance-types.js';

const logger = createLogger('task-summary-generator');

export class TaskSummaryGenerator extends EventEmitter {
  generate(events: Array<{ type: string; data?: any }>, sessionId: string, taskTitle?: string): TaskSummary {
    const toolStarts = events.filter((e) => e.type === 'tool_start');
    const toolEnds = events.filter((e) => e.type === 'tool_end');
    const totalSteps = toolStarts.length || 1;
    const currentStep = toolEnds.length;
    const progressPercent = Math.round((currentStep / totalSteps) * 100);

    const recentAction = this.compressAction(
      toolStarts.length > 0 ? `Executing: ${toolStarts[toolStarts.length - 1].data?.name || 'tool'}` : 'Processing...',
    );

    const keyOutputs = this.extractKeyOutputs(toolEnds);

    return {
      sessionId,
      title: taskTitle?.slice(0, 100) || 'Task',
      currentStep,
      totalSteps,
      progressPercent,
      recentAction,
      keyOutputs,
      status: progressPercent >= 100 ? 'completed' : 'running',
      updatedAt: Date.now(),
    };
  }

  extractProgress(events: Array<{ type: string }>): { currentStep: number; totalSteps: number; progressPercent: number } {
    const toolStarts = events.filter((e) => e.type === 'tool_start').length;
    const toolEnds = events.filter((e) => e.type === 'tool_end').length;
    const totalSteps = toolStarts || 1;
    return { currentStep: toolEnds, totalSteps, progressPercent: Math.round((toolEnds / totalSteps) * 100) };
  }

  compressAction(action: string): string {
    return action.length > 100 ? action.slice(0, 97) + '...' : action;
  }

  extractKeyOutputs(toolEnds: Array<{ type: string; data?: any }>): string[] {
    return toolEnds
      .slice(-5)
      .map((e) => {
        const result = e.data?.result || '';
        return result.length > 100 ? result.slice(0, 97) + '...' : result;
      })
      .filter(Boolean);
  }
}

export const taskSummaryGenerator = new TaskSummaryGenerator();