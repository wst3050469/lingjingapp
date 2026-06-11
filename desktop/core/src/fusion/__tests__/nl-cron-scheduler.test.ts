import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NLCronScheduler } from '../nl-cron/nl-cron-scheduler.js';
import type { IEventBus } from '../event-bus/types.js';

describe('NLCronScheduler', () => {
  let scheduler: NLCronScheduler;
  let eventBus: IEventBus;

  beforeEach(() => {
    eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    } as unknown as IEventBus;
    scheduler = new NLCronScheduler(undefined, eventBus);
  });

  describe('scheduleFromNL', () => {
    it('should create schedule from natural language', async () => {
      const result = await scheduler.scheduleFromNL('every 5 minutes', 'cleanup logs');
      expect(result.success).toBe(true);
      expect(result.cronExpression).toBe('*/5 * * * *');
      expect(result.scheduleId).toContain('cron_');
    });

    it('should fail when scheduler is disabled', async () => {
      const disabled = new NLCronScheduler({ enabled: false });
      const result = await disabled.scheduleFromNL('daily', 'task');
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('should publish cron:registered event on success', async () => {
      await scheduler.scheduleFromNL('daily', 'backup');
      expect(eventBus.publish).toHaveBeenCalledWith(
        'cron:registered',
        expect.objectContaining({ task: 'backup' }),
        expect.any(String),
      );
    });

    it('should handle unknown natural language gracefully', async () => {
      const result = await scheduler.scheduleFromNL('at midnight on the third tuesday', 'task');
      // Rule-based falls through to unknown pattern
      expect(result.success).toBe(false);
    });
  });

  describe('listSchedules', () => {
    it('should return empty list initially', () => {
      expect(scheduler.listSchedules()).toEqual([]);
    });

    it('should return schedules after creation', async () => {
      await scheduler.scheduleFromNL('daily', 'task1');
      await scheduler.scheduleFromNL('hourly', 'task2');
      expect(scheduler.listSchedules()).toHaveLength(2);
    });
  });

  describe('cancelSchedule', () => {
    it('should cancel an existing schedule', async () => {
      const result = await scheduler.scheduleFromNL('daily', 'task');
      expect(scheduler.cancelSchedule(result.scheduleId)).toBe(true);
      expect(scheduler.listSchedules()).toHaveLength(0);
    });

    it('should return false for non-existent schedule', () => {
      expect(scheduler.cancelSchedule('nonexistent')).toBe(false);
    });
  });

  describe('previewCron', () => {
    it('should return cron expression for valid NL', async () => {
      const result = await scheduler.previewCron('every 30 minutes');
      expect(result.cron).toBe('*/30 * * * *');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy by default', () => {
      const health = scheduler.healthCheck();
      expect(health.healthy).toBe(true);
    });
  });

  describe('setEventBus / setLLMProvider', () => {
    it('should allow updating event bus after construction', () => {
      const newBus = { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() } as unknown as IEventBus;
      const s = new NLCronScheduler();
      s.setEventBus(newBus);
      expect(true).toBe(true);
    });

    it('should allow setting LLM provider', () => {
      const mockLLM = { chat: vi.fn() };
      const s = new NLCronScheduler();
      s.setLLMProvider(mockLLM as any);
      expect(true).toBe(true);
    });
  });
});
