export interface NLCronConfig {
  enabled: boolean;
  conversionModel: string;
}

export interface CronSchedule {
  id: string;
  cronExpression: string;
  naturalLanguage: string;
  task: string;
  nextRunAt: number;
  enabled: boolean;
}

export interface ScheduleResult {
  scheduleId: string;
  cronExpression: string;
  success: boolean;
  error?: string;
}

export interface INLCronScheduler {
  scheduleFromNL(naturalLanguage: string, task: string): Promise<ScheduleResult>;
  listSchedules(): CronSchedule[];
  cancelSchedule(id: string): boolean;
  previewCron(naturalLanguage: string): Promise<{ cron: string; error?: string }>;
  healthCheck(): { healthy: boolean };
}

export const DEFAULT_NL_CRON_CONFIG: NLCronConfig = {
  enabled: true,
  conversionModel: 'rule-based',
};
