import { EventBusMetrics } from './types.js';

export class MetricsCollector {
  private _totalPublished = 0;
  private _totalDelivered = 0;
  private _totalErrors = 0;
  private _totalDeliveryMs = 0;
  private _startTime = Date.now();

  recordPublished(): void {
    this._totalPublished++;
  }

  recordDelivered(durationMs: number): void {
    this._totalDelivered++;
    this._totalDeliveryMs += durationMs;
  }

  recordError(): void {
    this._totalErrors++;
  }

  getMetrics(): EventBusMetrics {
    const elapsedSec = (Date.now() - this._startTime) / 1000;
    return {
      totalPublished: this._totalPublished,
      totalDelivered: this._totalDelivered,
      totalErrors: this._totalErrors,
      avgDeliveryMs: this._totalDelivered > 0 ? this._totalDeliveryMs / this._totalDelivered : 0,
      throughputPerSec: elapsedSec > 0 ? this._totalPublished / elapsedSec : 0,
    };
  }

  reset(): void {
    this._totalPublished = 0;
    this._totalDelivered = 0;
    this._totalErrors = 0;
    this._totalDeliveryMs = 0;
    this._startTime = Date.now();
  }
}
