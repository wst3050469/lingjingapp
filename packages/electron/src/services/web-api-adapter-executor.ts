import { createLogger } from '../monitoring/logger';
import WebSocket from 'ws';

const logger = createLogger('web-api-adapter-executor');

const WOKWI_API_BASE = 'https://wokwi.com/api';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export class WebApiAdapterExecutor {
  private apiToken: string;
  private wsConnections = new Map<string, WebSocket>();

  constructor() {
    this.apiToken = process.env.WOKWI_API_TOKEN || '';
  }

  async callApi(endpoint: string, method: string = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<{ success: boolean; data: any; status: number }> {
    const allHeaders = { ...headers, ...this.handleAuth() };
    const url = endpoint.startsWith('http') ? endpoint : `${WOKWI_API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...allHeaders },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        return { success: false, data: null, status: response.status };
      }

      const data = await response.json();
      return { success: true, data, status: response.status };
    } catch (err) {
      logger.error('Web API call failed', err as Error, { endpoint });
      return { success: false, data: null, status: 0 };
    }
  }

  handleAuth(): Record<string, string> {
    if (!this.apiToken) {
      logger.warn('WOKWI_API_TOKEN not set');
      return {};
    }
    return { Authorization: `Bearer ${this.apiToken}` };
  }

  async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = MAX_RETRIES, intervals: number[] = RETRY_DELAYS): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        if (err?.status === 401) throw err;
        if (attempt < maxRetries) {
          const delay = intervals[attempt] ?? intervals[intervals.length - 1];
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw new Error('Max retries exceeded');
  }

  connectWebSocket(url: string, onMessage: (data: any) => void, onError: (err: Error) => void): WebSocket {
    const ws = new WebSocket(url);
    ws.on('message', (data) => {
      try { onMessage(JSON.parse(data.toString())); } catch { onMessage(data.toString()); }
    });
    ws.on('error', (err) => { onError(err); });
    ws.on('close', () => { this.wsConnections.delete(url); });
    this.wsConnections.set(url, ws);
    return ws;
  }

  reconnectWebSocket(url: string, onMessage: (data: any) => void, onError: (err: Error) => void, maxDelay = 60000): void {
    let delay = 3000;
    const tryConnect = () => {
      const ws = this.connectWebSocket(url, onMessage, onError);
      ws.on('open', () => { delay = 3000; logger.info('WebSocket reconnected', { url }); });
      ws.on('close', () => {
        delay = Math.min(delay * 2, maxDelay);
        setTimeout(tryConnect, delay);
      });
    };
    tryConnect();
  }

  validateCircuitConfig(circuitJson: unknown): boolean {
    if (!circuitJson || typeof circuitJson !== 'object') return false;
    const obj = circuitJson as Record<string, unknown>;
    return typeof obj.version === 'number' && Array.isArray(obj.parts);
  }

  disconnectAll(): void {
    for (const [url, ws] of this.wsConnections) {
      ws.close();
    }
    this.wsConnections.clear();
  }
}

export const webApiAdapterExecutor = new WebApiAdapterExecutor();