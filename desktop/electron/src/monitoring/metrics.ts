import { EventEmitter } from 'events';

export interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncTime: number;
  lastSyncTime: number;
  pendingItems: number;
  conflictCount: number;
  offlineQueueSize: number;
}

export interface GitHubMetrics {
  totalApiCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rateLimitRemaining: number;
  rateLimitReset: number;
  activeAccounts: number;
}

export interface MonitoringData {
  sync: SyncMetrics;
  github: GitHubMetrics;
  timestamp: number;
}

class MetricsCollector extends EventEmitter {
  private syncMetrics: SyncMetrics = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    averageSyncTime: 0,
    lastSyncTime: 0,
    pendingItems: 0,
    conflictCount: 0,
    offlineQueueSize: 0
  };

  private githubMetrics: GitHubMetrics = {
    totalApiCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    rateLimitRemaining: 5000,
    rateLimitReset: Date.now() + 3600000,
    activeAccounts: 0
  };

  private syncTimes: number[] = [];

  recordSyncStart(): void {
    this.syncMetrics.totalSyncs++;
    this.emit('sync-start', { timestamp: Date.now() });
  }

  recordSyncSuccess(duration: number, itemsSynced: number): void {
    this.syncMetrics.successfulSyncs++;
    this.syncMetrics.lastSyncTime = Date.now();
    
    this.syncTimes.push(duration);
    if (this.syncTimes.length > 100) {
      this.syncTimes.shift();
    }
    this.syncMetrics.averageSyncTime = 
      this.syncTimes.reduce((a, b) => a + b, 0) / this.syncTimes.length;
    
    this.emit('sync-success', { duration, itemsSynced, timestamp: Date.now() });
  }

  recordSyncFailure(error: string): void {
    this.syncMetrics.failedSyncs++;
    this.emit('sync-failure', { error, timestamp: Date.now() });
    
    const failureRate = this.syncMetrics.failedSyncs / this.syncMetrics.totalSyncs;
    if (failureRate > 0.05) {
      this.emit('alert', {
        type: 'sync-failure-rate',
        message: `同步失败率 ${(failureRate * 100).toFixed(2)}% 超过阈值 5%`,
        severity: 'warning'
      });
    }
  }

  updatePendingItems(count: number): void {
    this.syncMetrics.pendingItems = count;
    
    if (count > 500) {
      this.emit('alert', {
        type: 'pending-items',
        message: `待同步项目 ${count} 超过阈值 500`,
        severity: 'warning'
      });
    }
  }

  updateConflictCount(count: number): void {
    this.syncMetrics.conflictCount = count;
  }

  updateOfflineQueueSize(size: number): void {
    this.syncMetrics.offlineQueueSize = size;
    
    if (size > 500) {
      this.emit('alert', {
        type: 'offline-queue',
        message: `离线队列 ${size} 超过阈值 500`,
        severity: 'warning'
      });
    }
  }

  recordGitHubApiCall(success: boolean): void {
    this.githubMetrics.totalApiCalls++;
    if (success) {
      this.githubMetrics.successfulCalls++;
    } else {
      this.githubMetrics.failedCalls++;
    }
  }

  updateRateLimit(remaining: number, reset: number): void {
    this.githubMetrics.rateLimitRemaining = remaining;
    this.githubMetrics.rateLimitReset = reset;
    
    if (remaining < 100) {
      this.emit('alert', {
        type: 'rate-limit',
        message: `GitHub API剩余配额 ${remaining} 即将耗尽`,
        severity: 'critical'
      });
    }
  }

  updateActiveAccounts(count: number): void {
    this.githubMetrics.activeAccounts = count;
  }

  getMetrics(): MonitoringData {
    return {
      sync: { ...this.syncMetrics },
      github: { ...this.githubMetrics },
      timestamp: Date.now()
    };
  }

  getSyncMetrics(): SyncMetrics {
    return { ...this.syncMetrics };
  }

  getGitHubMetrics(): GitHubMetrics {
    return { ...this.githubMetrics };
  }

  reset(): void {
    this.syncMetrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncTime: 0,
      lastSyncTime: 0,
      pendingItems: 0,
      conflictCount: 0,
      offlineQueueSize: 0
    };
    
    this.githubMetrics = {
      totalApiCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rateLimitRemaining: 5000,
      rateLimitReset: Date.now() + 3600000,
      activeAccounts: 0
    };
    
    this.syncTimes = [];
  }

  exportPrometheusFormat(): string {
    const lines: string[] = [];
    
    lines.push('# HELP sync_total Total number of syncs');
    lines.push('# TYPE sync_total counter');
    lines.push(`sync_total ${this.syncMetrics.totalSyncs}`);
    
    lines.push('# HELP sync_successful Successful syncs');
    lines.push('# TYPE sync_successful counter');
    lines.push(`sync_successful ${this.syncMetrics.successfulSyncs}`);
    
    lines.push('# HELP sync_failed Failed syncs');
    lines.push('# TYPE sync_failed counter');
    lines.push(`sync_failed ${this.syncMetrics.failedSyncs}`);
    
    lines.push('# HELP sync_duration_avg Average sync duration in ms');
    lines.push('# TYPE sync_duration_avg gauge');
    lines.push(`sync_duration_avg ${this.syncMetrics.averageSyncTime}`);
    
    lines.push('# HELP github_api_calls_total Total GitHub API calls');
    lines.push('# TYPE github_api_calls_total counter');
    lines.push(`github_api_calls_total ${this.githubMetrics.totalApiCalls}`);
    
    lines.push('# HELP github_rate_limit_remaining Remaining GitHub API rate limit');
    lines.push('# TYPE github_rate_limit_remaining gauge');
    lines.push(`github_rate_limit_remaining ${this.githubMetrics.rateLimitRemaining}`);
    
    return lines.join('\n');
  }
}

export const metricsCollector = new MetricsCollector();
