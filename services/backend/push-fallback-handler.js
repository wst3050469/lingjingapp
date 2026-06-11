import { createLogger } from '../monitoring/logger';

const logger = createLogger('push-fallback-handler');

export class PushFallbackHandler {
  private wsBroadcastFn?: (event: any) => void;

  setBroadcastFn(fn: (event: any) => void): void {
    this.wsBroadcastFn = fn;
  }

  async fallbackToWebSocket(sessionId: string, notification: { type: string; title: string; summary: string }): Promise<boolean> {
    if (!this.wsBroadcastFn) {
      logger.warn('No WebSocket broadcast function set, cannot fallback');
      return false;
    }

    try {
      this.wsBroadcastFn({
        type: 'push',
        channel: 'approval',
        event: 'fallback-notification',
        data: { sessionId, ...notification },
      });
      logger.info('Push fallback to WebSocket succeeded', { sessionId });
      return true;
    } catch (err) {
      logger.error('Push fallback to WebSocket failed', err as Error, { sessionId });
      return false;
    }
  }
}

export const pushFallbackHandler = new PushFallbackHandler();