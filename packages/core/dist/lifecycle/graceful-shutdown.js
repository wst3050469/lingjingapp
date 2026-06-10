import { HealthChecker } from '../observability/health-checker.js';
import { logger } from '../utils/logger.js';
export class GracefulShutdown {
    checker = new HealthChecker();
    isShuttingDown = false;
    cleanupFns = [];
    scheduler;
    constructor() {
        this.registerSignalHandlers();
    }
    registerCleanup(fn) {
        this.cleanupFns.push(fn);
    }
    setScheduler(scheduler) {
        this.scheduler = scheduler;
    }
    registerHealthCheck(name, check) {
        this.checker.register(name, check);
    }
    async shutdown(reason = 'SIGTERM') {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        logger.info(`Graceful shutdown initiated: ${reason}`);
        // Step 1: Cancel all running agents
        if (this.scheduler) {
            this.scheduler.cancelAll(reason);
            logger.info('All agents cancelled');
        }
        // Step 2: Run cleanup functions
        for (const fn of this.cleanupFns) {
            try {
                await fn();
            }
            catch (error) {
                logger.error('Cleanup error:', error instanceof Error ? error.message : String(error));
            }
        }
        // Step 3: Final health check
        try {
            const report = await this.checker.check();
            logger.info(`Final health status: ${report.status}`);
        }
        catch {
            // Ignore health check errors during shutdown
        }
        logger.info('Graceful shutdown complete');
    }
    isShuttingDownState() {
        return this.isShuttingDown;
    }
    registerSignalHandlers() {
        const handler = (signal) => {
            this.shutdown(signal).catch(() => process.exit(1));
        };
        if (typeof process !== 'undefined') {
            process.on('SIGTERM', () => handler('SIGTERM'));
            process.on('SIGINT', () => handler('SIGINT'));
        }
    }
}
//# sourceMappingURL=graceful-shutdown.js.map