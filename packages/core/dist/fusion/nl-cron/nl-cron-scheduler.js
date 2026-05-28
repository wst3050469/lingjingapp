"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NLCronScheduler = void 0;
const types_js_1 = require("./types.js");
const nl_to_cron_converter_js_1 = require("./nl-to-cron-converter.js");
function generateScheduleId() {
    return `cron_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
function computeNextRunAt(cronExpression) {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5)
        return Date.now() + 60000;
    const now = new Date();
    const minute = parts[0];
    const hour = parts[1];
    const next = new Date(now);
    if (minute !== '*' && !minute.startsWith('*/')) {
        next.setMinutes(parseInt(minute, 10), 0, 0);
    }
    else if (minute.startsWith('*/')) {
        const step = parseInt(minute.slice(2), 10);
        const currentMinute = now.getMinutes();
        const nextMinute = Math.ceil((currentMinute + 1) / step) * step;
        next.setMinutes(nextMinute, 0, 0);
    }
    else {
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
class NLCronScheduler {
    config;
    converter;
    schedules = new Map();
    eventBus = null;
    llmProvider = null;
    healthy = true;
    constructor(config, eventBus, llmProvider) {
        this.config = { ...types_js_1.DEFAULT_NL_CRON_CONFIG, ...config };
        this.converter = new nl_to_cron_converter_js_1.NLToCronConverter();
        if (eventBus)
            this.eventBus = eventBus;
        if (llmProvider)
            this.llmProvider = llmProvider;
    }
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }
    setLLMProvider(llmProvider) {
        this.llmProvider = llmProvider;
    }
    async scheduleFromNL(naturalLanguage, task) {
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
        const schedule = {
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
    listSchedules() {
        return Array.from(this.schedules.values());
    }
    cancelSchedule(id) {
        return this.schedules.delete(id);
    }
    async previewCron(naturalLanguage) {
        return this.converter.convert(naturalLanguage, this.llmProvider ?? undefined);
    }
    healthCheck() {
        return { healthy: this.healthy };
    }
}
exports.NLCronScheduler = NLCronScheduler;
//# sourceMappingURL=nl-cron-scheduler.js.map