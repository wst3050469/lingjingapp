import { app } from 'electron';

type CheckpointId = 'CP1' | 'CP2' | 'CP3' | 'CP4' | 'CP5' | 'CP6' | 'CP7' | 'CP8' | 'CP9';
type CheckpointStatus = 'passed' | 'failed' | 'timeout' | 'skipped';

interface StartupCheckpoint {
  id: CheckpointId;
  name: string;
  timestamp: string;
  status: CheckpointStatus;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

interface StartupHealthReport {
  version: string;
  platform: string;
  checkpoints: StartupCheckpoint[];
  totalTimeMs: number;
  status: 'healthy' | 'degraded' | 'failed';
  warnings: Array<{ checkpointId: CheckpointId; message: string }>;
}

const CHECKPOINT_TIMEOUTS: Record<CheckpointId, number> = {
  CP1: 0,
  CP2: 0,
  CP3: 15000,
  CP4: 5000,
  CP5: 5000,
  CP6: 5000,
  CP7: 10000,
  CP8: 15000,
  CP9: 5000,
};

class StartupHealthCheck {
  private checkpoints: StartupCheckpoint[] = [];
  private lastTimestamp: number = Date.now();
  private warnings: Array<{ checkpointId: CheckpointId; message: string }> = [];
  private bootLogFn: ((s: string) => void) | null = null;

  setBootLogFn(fn: (s: string) => void): void {
    this.bootLogFn = fn;
  }

  record(id: CheckpointId, name: string, status: CheckpointStatus, metadata?: Record<string, unknown>): void {
    const now = Date.now();
    const durationMs = now - this.lastTimestamp;
    const checkpoint: StartupCheckpoint = {
      id, name,
      timestamp: new Date(now).toISOString(),
      status, durationMs, metadata,
    };
    this.checkpoints.push(checkpoint);
    this.lastTimestamp = now;

    const timeout = CHECKPOINT_TIMEOUTS[id];
    if (timeout > 0 && durationMs > timeout) {
      const warning = { checkpointId: id, message: `[WARN] ${id} timeout after ${durationMs}ms (threshold: ${timeout}ms)` };
      this.warnings.push(warning);
      if (this.bootLogFn) this.bootLogFn(warning.message);
    }

    const logLine = `${id}:${name} status=${status} duration=${durationMs}ms${metadata ? ' ' + JSON.stringify(metadata) : ''}`;
    if (this.bootLogFn) this.bootLogFn(logLine);
  }

  getReport(): StartupHealthReport {
    const failedOrTimeout = this.checkpoints.filter(cp => cp.status === 'failed' || cp.status === 'timeout');
    const status = failedOrTimeout.length === 0 ? 'healthy'
      : failedOrTimeout.some(cp => ['CP3', 'CP4', 'CP7'].includes(cp.id)) ? 'failed'
      : 'degraded';

    return {
      version: app.getVersion(),
      platform: process.platform,
      checkpoints: this.checkpoints,
      totalTimeMs: this.checkpoints.length > 0
        ? Date.now() - new Date(this.checkpoints[0].timestamp).getTime()
        : 0,
      status, warnings: this.warnings,
    };
  }

  getFailedCheckpoints(): CheckpointId[] {
    return this.checkpoints
      .filter(cp => cp.status === 'failed' || cp.status === 'timeout')
      .map(cp => cp.id);
  }
}

export const startupHealthCheck = new StartupHealthCheck();
export type { CheckpointId, CheckpointStatus, StartupCheckpoint, StartupHealthReport };