import { EventEmitter } from 'events';
import crypto from 'crypto';
import { createLogger } from '../monitoring/logger';
import WebSocket from 'ws';
import { agentSessionManager } from './agent-session-manager.js';

const logger = createLogger('websocket-gateway');

const MAX_DEVICES_PER_DESKTOP = 3;

interface ConnectedDevice {
  ws: WebSocket;
  deviceId: string;
  connectedAt: number;
}

export interface WsCommand {
  type: 'cmd';
  id: string;
  channel: string;
  action: string;
  payload?: any;
}

export interface WsAck {
  type: 'ack';
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export interface WsPush {
  type: 'push';
  channel: string;
  event: string;
  data: any;
}

export class WebSocketGateway extends EventEmitter {
  private devices = new Map<string, ConnectedDevice>();
  private offlineQueues = new Map<string, WsCommand[]>();

  authenticate(token: string, expectedToken: string): boolean {
    // DEF-013: Use timing-safe comparison to prevent timing side-channel attacks
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  }

  handleCommand(ws: WebSocket, msg: WsCommand, db: any): void {
    const { id, channel, action, payload = {} } = msg;
    this.emit('command', { ws, channel, action, payload, id });
  }

  /**
   * Subscribe a device. Enforces device limit and cleans up stale connections.
   *
   * BUG-008: Enforces MAX_DEVICES_PER_DESKTOP. If the limit is reached and
   * the deviceId is NOT already connected, the subscription is rejected.
   *
   * BUG-007: If the same deviceId re-subscribes (e.g., reconnect), the old
   * WebSocket is closed before registering the new one — preventing orphaned
   * connections and memory leaks.
   */
  subscribe(ws: WebSocket, deviceId: string, channel: string): void {
    const existing = this.devices.get(deviceId);

    // BUG-007: Reconnect — close old WebSocket before replacing
    if (existing) {
      logger.info('Device re-subscribing, closing old connection', { deviceId });
      try {
        // 1001 = Going Away (browser tab closed / app navigated away)
        existing.ws.close(1001, 'Replaced by new connection');
      } catch {
        // Socket may already be in CLOSING/CLOSED state
      }
    }

    // BUG-008: Enforce device limit
    if (!existing && !this.canAcceptNewDevice()) {
      logger.warn('Device subscription rejected — limit reached', {
        deviceId,
        currentCount: this.devices.size,
        max: MAX_DEVICES_PER_DESKTOP,
      });
      // Send error back to the connecting device before closing
      try {
        ws.send(JSON.stringify({
          type: 'ack',
          id: 'subscribe',
          success: false,
          error: `Device limit reached (max ${MAX_DEVICES_PER_DESKTOP}). Disconnect another device first.`,
        }));
        ws.close(1013, 'Device limit reached');
      } catch { /* ignore */ }
      return;
    }

    this.devices.set(deviceId, { ws, deviceId, connectedAt: Date.now() });
    logger.info('Device subscribed', { deviceId, channel, totalDevices: this.devices.size });
  }

  broadcastToMobile(event: WsPush): void {
    const message = JSON.stringify(event);
    for (const [deviceId, device] of this.devices) {
      if (device.ws.readyState === 1) {
        try {
          device.ws.send(message);
        } catch (err) {
          logger.error('Failed to push to device', err as Error, { deviceId });
        }
      }
    }
  }

  handleReconnect(deviceId: string, ws: WebSocket): void {
    this.devices.set(deviceId, { ws, deviceId, connectedAt: Date.now() });
    const queue = this.offlineQueues.get(deviceId);
    if (queue && queue.length > 0) {
      logger.info('Replaying offline queue', { deviceId, count: queue.length });
      for (const cmd of queue) {
        try {
          ws.send(JSON.stringify(cmd));
        } catch {}
      }
      this.offlineQueues.delete(deviceId);
    }
  }

  queueOfflineCommand(deviceId: string, cmd: WsCommand): void {
    const queue = this.offlineQueues.get(deviceId) ?? [];
    queue.push(cmd);
    if (queue.length > 100) queue.shift();
    this.offlineQueues.set(deviceId, queue);
  }

  getConnectedDeviceCount(): number {
    return this.devices.size;
  }

  canAcceptNewDevice(): boolean {
    return this.devices.size < MAX_DEVICES_PER_DESKTOP;
  }

  /**
   * Disconnect a device. Closes its WebSocket and removes it from the registry.
   */
  disconnectDevice(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      try {
        device.ws.close(1000, 'Disconnected by server');
      } catch { /* already closed */ }
    }
    this.devices.delete(deviceId);
    logger.info('Device disconnected', { deviceId, remainingDevices: this.devices.size });
  }
}

export const webSocketGateway = new WebSocketGateway();
