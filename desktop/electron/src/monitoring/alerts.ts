import { EventEmitter } from 'events';

export interface Alert {
  id: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private thresholds = {
    syncFailureRate: 0.05,
    pendingItems: 500,
    offlineQueueSize: 500,
    rateLimitRemaining: 100
  };

  createAlert(
    type: string,
    message: string,
    severity: Alert['severity'],
    metadata?: Record<string, any>
  ): Alert {
    const id = `${type}-${Date.now()}`;
    
    const alert: Alert = {
      id,
      type,
      message,
      severity,
      timestamp: Date.now(),
      acknowledged: false,
      metadata
    };

    this.alerts.set(id, alert);
    this.emit('alert', alert);

    if (severity === 'critical') {
      this.emit('critical', alert);
    }

    console.warn(`[Alert] [${severity.toUpperCase()}] ${message}`);
    
    return alert;
  }

  acknowledge(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('acknowledged', alert);
    }
  }

  dismiss(alertId: string): void {
    this.alerts.delete(alertId);
    this.emit('dismissed', alertId);
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(a => !a.acknowledged)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  checkSyncFailureRate(failed: number, total: number): void {
    if (total === 0) return;
    
    const rate = failed / total;
    if (rate > this.thresholds.syncFailureRate) {
      this.createAlert(
        'sync-failure-rate',
        `同步失败率 ${(rate * 100).toFixed(2)}% 超过阈值 ${(this.thresholds.syncFailureRate * 100)}%`,
        'warning',
        { failed, total, rate }
      );
    }
  }

  checkPendingItems(count: number): void {
    if (count > this.thresholds.pendingItems) {
      this.createAlert(
        'pending-items',
        `待同步项目 ${count} 超过阈值 ${this.thresholds.pendingItems}`,
        'warning',
        { count, threshold: this.thresholds.pendingItems }
      );
    }
  }

  checkOfflineQueueSize(size: number): void {
    if (size > this.thresholds.offlineQueueSize) {
      this.createAlert(
        'offline-queue',
        `离线队列 ${size} 超过阈值 ${this.thresholds.offlineQueueSize}`,
        'warning',
        { size, threshold: this.thresholds.offlineQueueSize }
      );
    }
  }

  checkRateLimit(remaining: number, resetTime: number): void {
    if (remaining < this.thresholds.rateLimitRemaining) {
      const severity = remaining < 10 ? 'critical' : 'warning';
      this.createAlert(
        'rate-limit',
        `GitHub API剩余配额 ${remaining} 即将耗尽，重置时间: ${new Date(resetTime).toISOString()}`,
        severity,
        { remaining, resetTime }
      );
    }
  }

  setThreshold(type: keyof typeof this.thresholds, value: number): void {
    this.thresholds[type] = value;
  }

  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  clear(): void {
    this.alerts.clear();
    this.emit('cleared');
  }

  prune(maxAge: number = 86400000): void {
    const cutoff = Date.now() - maxAge;
    
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoff) {
        this.alerts.delete(id);
      }
    }
  }
}

export const alertManager = new AlertManager();
