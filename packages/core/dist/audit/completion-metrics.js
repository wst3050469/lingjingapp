export class CompletionMetrics {
    events = [];
    maxEvents = 1000;
    record(event) {
        this.events.push(event);
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }
    }
    getAcceptRate() {
        if (this.events.length === 0)
            return 0;
        return this.events.filter(e => e.accepted).length / this.events.length;
    }
    getAverageLatency() {
        if (this.events.length === 0)
            return { firstToken: 0, total: 0 };
        const avgFirst = this.events.reduce((s, e) => s + e.firstTokenLatencyMs, 0) / this.events.length;
        const avgTotal = this.events.reduce((s, e) => s + e.totalLatencyMs, 0) / this.events.length;
        return { firstToken: Math.round(avgFirst), total: Math.round(avgTotal) };
    }
    getRecentEvents(count = 100) {
        return this.events.slice(-count);
    }
}
//# sourceMappingURL=completion-metrics.js.map