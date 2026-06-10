import { EventBusMetrics } from './types.js';
export declare class MetricsCollector {
    private _totalPublished;
    private _totalDelivered;
    private _totalErrors;
    private _totalDeliveryMs;
    private _startTime;
    recordPublished(): void;
    recordDelivered(durationMs: number): void;
    recordError(): void;
    getMetrics(): EventBusMetrics;
    reset(): void;
}
//# sourceMappingURL=metrics.d.ts.map