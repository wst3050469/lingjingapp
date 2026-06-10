import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';

const logger = createLogger('interruption-detector');

const HEARTBEAT_INTERVAL_MS = 5000;
const TIMEOUT_MS = 120000;

export class InterruptionDetector extends EventEmitter {
  private timers = new Map<string, { heartbeat: NodeJS.Timeout; timeout: NodeJS.Timeout; lastHeartbeat: number }>();
  private interrupted = new Set<string>();

  startMonitoring(sessionId: string): void {
    if (this.timers.has(sessionId)) return;

    const now = Date.now();
    const heartbeat = setInterval(() => {
      const timer = this.timers.get(sessionId);
      if (timer) {
        timer.lastHeartbeat = Date.now();
        this.checkTimeout(sessionId);
      }
    }, HEARTBEAT_INTERVAL_MS);

    const timeout = setTimeout(() => {
      this.checkTimeout(sessionId);
    }, TIMEOUT_MS);

    this.timers.set(sessionId, { heartbeat, timeout, lastHeartbeat: now });
    logger.info('Monitoring started', { sessionId });
  }

  stopMonitoring(sessionId: string): void {
    const timer = this.timers.get(sessionId);
    if (!timer) return;
    clearInterval(timer.heartbeat);
    clearTimeout(timer.timeout);
    this.timers.delete(sessionId);
    logger.info('Monitoring stopped', { sessionId });
  }

  checkTimeout(sessionId: string): void {
    const timer = this.timers.get(sessionId);
    if (!timer) return;
    const elapsed = Date.now() - timer.lastHeartbeat;
    if (elapsed > TIMEOUT_MS && !this.interrupted.has(sessionId)) {
      this.markInterrupted(sessionId);
    }
  }

  markInterrupted(sessionId: string): void {
    this.interrupted.add(sessionId);
    logger.warn('Session interrupted', { sessionId });
    this.emit('interrupted', { sessionId });
    this.triggerRecovery(sessionId);
  }

  triggerRecovery(sessionId: string): void {
    logger.info('Triggering auto-recovery', { sessionId });
    this.emit('recovery-requested', { sessionId });
  }

  clearInterrupted(sessionId: string): void {
    this.interrupted.delete(sessionId);
    const timer = this.timers.get(sessionId);
    if (timer) {
      timer.lastHeartbeat = Date.now();
    }
  }

  isInterrupted(sessionId: string): boolean {
    return this.interrupted.has(sessionId);
  }
}

export const interruptionDetector = new InterruptionDetector();