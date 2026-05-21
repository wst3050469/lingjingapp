export interface CompletionMetricEvent {
    sessionId: string;
    firstTokenLatencyMs: number;
    totalLatencyMs: number;
    accepted: boolean;
    languageId: string;
    timestamp: Date;
}
export declare class CompletionMetrics {
    private events;
    private readonly maxEvents;
    record(event: CompletionMetricEvent): void;
    getAcceptRate(): number;
    getAverageLatency(): {
        firstToken: number;
        total: number;
    };
    getRecentEvents(count?: number): CompletionMetricEvent[];
}
//# sourceMappingURL=completion-metrics.d.ts.map