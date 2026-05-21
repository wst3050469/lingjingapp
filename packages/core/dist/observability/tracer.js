class ConsoleTraceExporter {
    export(spans) {
        for (const span of spans) {
            const duration = span.endTime ? span.endTime - span.startTime : 'ongoing';
            console.log(`[Trace] ${span.operation} (${duration}ms) traceId=${span.traceId} spanId=${span.spanId} status=${span.status}`);
        }
    }
}
let spanCounter = 0;
function generateSpanId() {
    return `span_${Date.now().toString(36)}_${(++spanCounter).toString(36)}`;
}
function generateTraceId() {
    return `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
export class Tracer {
    exporter;
    samplingRate;
    activeSpans = new Map();
    constructor(exporter, samplingRate = 1.0) {
        this.exporter = exporter ?? new ConsoleTraceExporter();
        this.samplingRate = samplingRate;
    }
    startTrace(operation, attributes) {
        const traceId = generateTraceId();
        return this.startSpan(operation, undefined, { ...attributes, traceId });
    }
    startSpan(operation, parentSpan, attributes) {
        if (Math.random() > this.samplingRate) {
            return this.createNoopSpan();
        }
        const span = {
            traceId: parentSpan?.traceId ?? generateTraceId(),
            spanId: generateSpanId(),
            parentSpanId: parentSpan?.spanId,
            operation,
            startTime: Date.now(),
            attributes: attributes ?? {},
            events: [],
            status: 'ok',
        };
        this.activeSpans.set(span.spanId, span);
        return span;
    }
    endSpan(span) {
        if (!span.spanId || span.spanId.startsWith('noop'))
            return;
        span.endTime = Date.now();
        this.activeSpans.delete(span.spanId);
        this.exporter.export([span]);
    }
    setError(span, error) {
        span.status = 'error';
        span.attributes['error.type'] = error.name;
        span.attributes['error.message'] = error.message;
    }
    addEvent(span, name, attributes) {
        span.events.push({ name, time: Date.now(), attributes });
    }
    getActiveSpanCount() {
        return this.activeSpans.size;
    }
    createNoopSpan() {
        return {
            traceId: 'noop',
            spanId: `noop_${++spanCounter}`,
            operation: 'noop',
            startTime: 0,
            attributes: {},
            events: [],
            status: 'ok',
        };
    }
}
//# sourceMappingURL=tracer.js.map