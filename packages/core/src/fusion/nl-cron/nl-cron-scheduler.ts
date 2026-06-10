import type { IEventBus } from '../event-bus/types.js';
import type { LLMProvider } from '../adapters/types.js';
import type { NLCronConfig, CronSchedule, ScheduleResult, INLCronScheduler } from './types.js';
import { DEFAULT_NL_CRON_CONFIG } from './types.js';
import { NLToCronConverter } from './nl-to-cron-converter.js';

function generateScheduleId(): string {
  return `cron_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function computeNextRunAt(cronExpression: string): number {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return Date.now() + 60000;
  const now = new Date();
  const minute = parts[0];
  const hour = parts[1];
  const next = new Date(now);
  if (minute !== '*' && !minute.startsWith('*/')) {
    next.setMinutes(parseInt(minute, 10), 0, 0);
  } else if (minute.startsWith('*/')) {
    const step = parseInt(minute.slice(2), 10);
    const currentMinute = now.getMinutes();
    const nextMinute = Math.ceil((currentMinute + 1) / step) * step;
    next.setMinutes(nextMinute, 0, 0);
  } else {
    next.setMinutes(now.getMinutes() + 1, 0, 0);
  }
  if (hour !== '*' && !hour.startsWith('*/')) {
    next.setHours(parseInt(hour, 10), 0, 0, 0);
  }
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

export class NLCronScheduler implements INLCronScheduler {
  private config: NLCronConfig;
  private converter: NLToCronConverter;
  private schedules = new Map<string, CronSchedule>();
  private eventBus: IEventBus | null = null;
  private llmProvider: LLMProvider | null = null;
  private healthy = true;

  constructor(config?: Partial<NLCronConfig>, eventBus?: IEventBus, llmProvider?: LLMProvider) {
    this.config = { ...DEFAULT_NL_CRON_CONFIG, ...config };
    this.converter = new NLToCronConverter();
    if (eventBus) this.eventBus = eventBus;
    if (llmProvider) this.llmProvider = llmProvider;
  }

  setEventBus(eventBus: IEventBus): void {
    this.eventBus = eventBus;
  }

  setLLMProvider(llmProvider: LLMProvider): void {
    this.llmProvider = llmProvider;
  }

  async scheduleFromNL(naturalLanguage: string, task: string): Promise<ScheduleResult> {
    if (!this.config.enabled) {
      return { scheduleId: '', cronExpression: '', success: false, error: 'NLCronScheduler is disabled' };
    }

    const result = await this.converter.convert(naturalLanguage, this.llmProvider ?? undefined);
    if (result.error || !result.cron) {
      return { scheduleId: '', cronExpression: '', success: false, error: result.error ?? 'Conversion failed' };
    }

    if (!this.converter.validateCron(result.cron)) {
      return { scheduleId: '', cronExpression: result.cron, success: false, error: 'Invalid cron expression' };
    }

    const id = generateScheduleId();
    const nextRunAt = computeNextRunAt(result.cron);
    const schedule: CronSchedule = {
      id,
      cronExpression: result.cron,
      naturalLanguage,
      task,
      nextRunAt,
      enabled: true,
    };

    this.schedules.set(id, schedule);

    this.eventBus?.publish('cron:registered', { scheduleId: id, cronExpression: result.cron, task }, 'NLCronScheduler');

    return { scheduleId: id, cronExpression: result.cron, success: true };
  }

  listSchedules(): CronSchedule[] {
    return Array.from(this.schedules.values());
  }

  cancelSchedule(id: string): boolean {
    return this.schedules.delete(id);
  }

  async previewCron(naturalLanguage: string): Promise<{ cron: string; error?: string }> {
    return this.converter.convert(naturalLanguage, this.llmProvider ?? undefined);
  }

  healthCheck(): { healthy: boolean } {
    return { healthy: this.healthy };
  }
}
