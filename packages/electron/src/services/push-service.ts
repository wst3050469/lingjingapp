import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import type { PushNotificationType, PushDeliveryStatus } from '../db/types/ide-enhance-types.js';

const logger = createLogger('push-service');

const DEDUP_WINDOW_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 30000];

interface PendingNotification {
  id: string;
  type: PushNotificationType;
  sessionId: string;
  deviceId: string;
  title: string;
  summary: string;
  retryCount: number;
  createdAt: number;
}

export class PushService extends EventEmitter {
  private dedupCache = new Map<string, number>();

  async send(notification: { type: PushNotificationType; sessionId: string; deviceId: string; title: string; summary: string }): Promise<{ success: boolean; notificationId?: string }> {
    const dedupKey = `${notification.sessionId}:${notification.type}`;
    const lastSent = this.dedupCache.get(dedupKey);
    if (lastSent && Date.now() - lastSent < DEDUP_WINDOW_MS) {
      logger.debug('Notification deduplicated', { dedupKey });
      return { success: true, notificationId: 'dedup' };
    }

    this.dedupCache.set(dedupKey, Date.now());
    const id = `push-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const channel = await this.selectChannel(notification.deviceId);
    const result = await this.retryWithBackoff(id, notification, channel);

    if (result) {
      this.emit('sent', { notificationId: id, ...notification });
      return { success: true, notificationId: id };
    }

    this.emit('send-failed', { notificationId: id, ...notification });
    return { success: false };
  }

  deduplicate(key: string): boolean {
    const last = this.dedupCache.get(key);
    if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
    this.dedupCache.set(key, Date.now());
    return false;
  }

  async selectChannel(deviceId: string): Promise<'apns' | 'fcm' | 'websocket'> {
    return 'websocket';
  }

  async retryWithBackoff(id: string, notification: any, channel: string, attempt = 0): Promise<boolean> {
    try {
      if (channel === 'apns' || channel === 'fcm') {
        return true;
      }
      return true;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt] ?? 30000;
        await new Promise((r) => setTimeout(r, delay));
        return this.retryWithBackoff(id, notification, channel, attempt + 1);
      }
      logger.error('Push failed after max retries', err as Error, { id });
      return false;
    }
  }
}

export const pushService = new PushService();