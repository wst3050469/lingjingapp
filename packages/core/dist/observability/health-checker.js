export class HealthChecker {
    checks = new Map();
    timeoutMs;
    constructor(timeoutMs = 5000) {
        this.timeoutMs = timeoutMs;
    }
    register(name, check) {
        this.checks.set(name, { name, check });
    }
    unregister(name) {
        this.checks.delete(name);
    }
    async check() {
        const results = {};
        let overallStatus = 'healthy';
        const promises = Array.from(this.checks.values()).map(async (hc) => {
            try {
                const result = await Promise.race([
                    hc.check(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), this.timeoutMs)),
                ]);
                results[hc.name] = result;
            }
            catch (error) {
                results[hc.name] = {
                    status: 'unhealthy',
                    message: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
        await Promise.allSettled(promises);
        const allResults = Object.values(results);
        if (allResults.some((r) => r.status === 'unhealthy')) {
            overallStatus = 'unhealthy';
        }
        else if (allResults.some((r) => r.status === 'degraded')) {
            overallStatus = 'degraded';
        }
        return {
            status: overallStatus,
            checks: results,
            timestamp: Date.now(),
        };
    }
}
//# sourceMappingURL=health-checker.js.map