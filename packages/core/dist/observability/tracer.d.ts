export interface Span {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operation: string;
    startTime: number;
    endTime?: number;
    attributes: Record<string, unknown>;
    events: Array<{
        name: string;
        time: number;
        attributes?: Record<string, unknown>;
    }>;
    status: 'ok' | 'error';
}
export interface TraceExporter {
    export(spans: Span[]): void;
}
export declare class Tracer {
    private exporter;
    private samplingRate;
    private activeSpans;
    constructor(exporter?: TraceExporter, samplingRate?: number);
    startTrace(operation: string, attributes?: Record<string, unknown>): Span;
    startSpan(operation: string, parentSpan?: Span, attributes?: Record<string, unknown>): Span;
    endSpan(span: Span): void;
    setError(span: Span, error: Error): void;
    addEvent(span: Span, name: string, attributes?: Record<string, unknown>): void;
    getActiveSpanCount(): number;
    private createNoopSpan;
}
//# sourceMappingURL=tracer.d.ts.map