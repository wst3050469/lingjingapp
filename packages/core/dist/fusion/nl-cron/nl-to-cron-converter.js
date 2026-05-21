const NL_CRON_MAP = [
    { pattern: /每5分钟|every 5 minutes/i, cron: '*/5 * * * *' },
    { pattern: /每10分钟|every 10 minutes/i, cron: '*/10 * * * *' },
    { pattern: /每15分钟|every 15 minutes/i, cron: '*/15 * * * *' },
    { pattern: /每30分钟|every 30 minutes/i, cron: '*/30 * * * *' },
    { pattern: /每小时|every hour|hourly/i, cron: '0 * * * *' },
    { pattern: /每天|every day|daily/i, cron: '0 0 * * *' },
    { pattern: /每周一|every monday/i, cron: '0 0 * * 1' },
    { pattern: /每周二|every tuesday/i, cron: '0 0 * * 2' },
    { pattern: /每周三|every wednesday/i, cron: '0 0 * * 3' },
    { pattern: /每周四|every thursday/i, cron: '0 0 * * 4' },
    { pattern: /每周五|every friday/i, cron: '0 0 * * 5' },
    { pattern: /每周六|every saturday/i, cron: '0 0 * * 6' },
    { pattern: /每周日|every sunday/i, cron: '0 0 * * 0' },
    { pattern: /每周|every week|weekly/i, cron: '0 0 * * 1' },
    { pattern: /每月|every month|monthly/i, cron: '0 0 1 * *' },
];
export class NLToCronConverter {
    convert(naturalLanguage, llmProvider) {
        if (llmProvider) {
            return this.tryLLMConversion(naturalLanguage, llmProvider);
        }
        return Promise.resolve(this.ruleBasedConvert(naturalLanguage));
    }
    async tryLLMConversion(naturalLanguage, llmProvider) {
        try {
            const stream = llmProvider.chat({
                messages: [
                    { role: 'system', content: 'Convert the following natural language time expression to a 5-field cron expression. Only output the cron expression, nothing else.' },
                    { role: 'user', content: naturalLanguage },
                ],
            });
            let result = '';
            for await (const event of stream) {
                if (event.type === 'text_delta') {
                    result += event.text;
                }
            }
            result = result.trim();
            if (this.validateCron(result)) {
                return { cron: result };
            }
            return this.ruleBasedConvert(naturalLanguage);
        }
        catch {
            return this.ruleBasedConvert(naturalLanguage);
        }
    }
    ruleBasedConvert(naturalLanguage) {
        for (const entry of NL_CRON_MAP) {
            if (entry.pattern.test(naturalLanguage)) {
                return { cron: entry.cron };
            }
        }
        return { cron: '', error: `No matching rule for: "${naturalLanguage}"` };
    }
    validateCron(cron) {
        const parts = cron.trim().split(/\s+/);
        if (parts.length !== 5)
            return false;
        const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
        if (!this.validateField(minute, 0, 59))
            return false;
        if (!this.validateField(hour, 0, 23))
            return false;
        if (!this.validateField(dayOfMonth, 1, 31))
            return false;
        if (!this.validateField(month, 1, 12))
            return false;
        if (!this.validateField(dayOfWeek, 0, 6))
            return false;
        return true;
    }
    validateField(field, min, max) {
        if (field === '*')
            return true;
        if (field.startsWith('*/')) {
            const step = parseInt(field.slice(2), 10);
            return !isNaN(step) && step >= 1 && step <= max;
        }
        if (field.includes(',')) {
            return field.split(',').every((p) => this.validateField(p, min, max));
        }
        if (field.includes('-')) {
            const [start, end] = field.split('-').map((v) => parseInt(v, 10));
            return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end;
        }
        const val = parseInt(field, 10);
        return !isNaN(val) && val >= min && val <= max;
    }
}
//# sourceMappingURL=nl-to-cron-converter.js.map