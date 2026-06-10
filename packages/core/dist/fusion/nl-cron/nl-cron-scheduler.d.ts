import type { IEventBus } from '../event-bus/types.js';
import type { LLMProvider } from '../adapters/types.js';
import type { NLCronConfig, CronSchedule, ScheduleResult, INLCronScheduler } from './types.js';
export declare class NLCronScheduler implements INLCronScheduler {
    private config;
    private converter;
    private schedules;
    private eventBus;
    private llmProvider;
    private healthy;
    constructor(config?: Partial<NLCronConfig>, eventBus?: IEventBus, llmProvider?: LLMProvider);
    setEventBus(eventBus: IEventBus): void;
    setLLMProvider(llmProvider: LLMProvider): void;
    scheduleFromNL(naturalLanguage: string, task: string): Promise<ScheduleResult>;
    listSchedules(): CronSchedule[];
    cancelSchedule(id: string): boolean;
    previewCron(naturalLanguage: string): Promise<{
        cron: string;
        error?: string;
    }>;
    healthCheck(): {
        healthy: boolean;
    };
}
//# sourceMappingURL=nl-cron-scheduler.d.ts.map