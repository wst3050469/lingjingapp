const DEFAULT_POLICY = {
    mode: 'exponentialBackoff',
    maxRetries: 3,
    maxTotalTimeMs: 120000,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
};
export async function withRetry(fn, policy = {}) {
    const config = { ...DEFAULT_POLICY, ...policy };
    if (config.mode === 'noRetry') {
        return fn();
    }
    const startTime = Date.now();
    let lastError;
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= config.maxTotalTimeMs) {
            break;
        }
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === config.maxRetries)
                break;
            if (config.shouldRetry && !config.shouldRetry(error))
                break;
            let delay;
            switch (config.mode) {
                case 'exponentialBackoff':
                    delay = Math.min(config.initialDelayMs * Math.pow(2, attempt) + Math.random() * 500, config.maxDelayMs);
                    break;
                case 'fixedInterval':
                    delay = config.initialDelayMs;
                    break;
                default:
                    delay = config.initialDelayMs;
            }
            const remainingTime = config.maxTotalTimeMs - (Date.now() - startTime);
            if (remainingTime <= 0)
                break;
            delay = Math.min(delay, remainingTime);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
//# sourceMappingURL=retry.js.map