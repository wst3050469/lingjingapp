export class MetricsCollector {
    _totalPublished = 0;
    _totalDelivered = 0;
    _totalErrors = 0;
    _totalDeliveryMs = 0;
    _startTime = Date.now();
    recordPublished() {
        this._totalPublished++;
    }
    recordDelivered(durationMs) {
        this._totalDelivered++;
        this._totalDeliveryMs += durationMs;
    }
    recordError() {
        this._totalErrors++;
    }
    getMetrics() {
        const elapsedSec = (Date.now() - this._startTime) / 1000;
        return {
            totalPublished: this._totalPublished,
            totalDelivered: this._totalDelivered,
            totalErrors: this._totalErrors,
            avgDeliveryMs: this._totalDelivered > 0 ? this._totalDeliveryMs / this._totalDelivered : 0,
            throughputPerSec: elapsedSec > 0 ? this._totalPublished / elapsedSec : 0,
        };
    }
    reset() {
        this._totalPublished = 0;
        this._totalDelivered = 0;
        this._totalErrors = 0;
        this._totalDeliveryMs = 0;
        this._startTime = Date.now();
    }
}
//# sourceMappingURL=metrics.js.map