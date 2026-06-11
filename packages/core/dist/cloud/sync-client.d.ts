import { OfflineQueue } from './offline-queue.js';
import type { CloudSession, CloudMemory } from './types.js';
export interface CloudSyncClientOptions {
    url?: string;
    apiKey?: string;
    enabled?: boolean;
    deviceId?: string;
    deviceName?: string;
}
type EventListener = (data: any) => void;
export declare class CloudSyncClient {
    url: string;
    apiKey: string;
    enabled: boolean;
    token: string | null;
    deviceId: string;
    deviceName: string;
    ws: WebSocket | null;
    wsReconnectTimer: ReturnType<typeof setTimeout> | null;
    /** Heartbeat timer: sends ping every 30s to keep WebSocket alive */
    _heartbeatTimer: ReturnType<typeof setInterval> | null;
    syncTimer: ReturnType<typeof setInterval> | null;
    listeners: Map<string, Set<EventListener>>;
    queue: OfflineQueue;
    private _online;
    /** Reconnection backoff state */
    private _reconnectAttempts;
    private _maxReconnectAttempts;
    constructor(options?: CloudSyncClientOptions);
    /** Auto-register device and get JWT token */
    autoRegister(): Promise<boolean>;
    authHeaders(): Record<string, string>;
    /** Direct request without queue */
    _directRequest(method: string, path: string, body?: any): Promise<any>;
    request(method: string, path: string, body?: any): Promise<any>;
    /** Set a user JWT token directly (overrides device registration token) */
    setToken(token: string): void;
    /** Clear token (fall back to device registration) */
    clearToken(): void;
    getDeviceId(): string;
    getDeviceName(): string;
    hasToken(): boolean;
    listSessions(): Promise<CloudSession[]>;
    getSession(id: string): Promise<CloudSession>;
    upsertSession(session: Partial<CloudSession>): Promise<CloudSession>;
    deleteSession(id: string): Promise<void>;
    listMemories(query?: string): Promise<CloudMemory[]>;
    upsertMemory(memory: Partial<CloudMemory>): Promise<CloudMemory>;
    deleteMemory(id: string): Promise<void>;
    triggerWebhook(channel: string, payload: any): Promise<any>;
    getWebhookLogs(channel: string): Promise<any>;
    healthCheck(): Promise<boolean>;
    /** Start heartbeat: sends ping every 30s to keep WebSocket alive */
    private _startHeartbeat;
    /** Stop heartbeat timer */
    private _stopHeartbeat;
    connectWebSocket(): void;
    scheduleReconnect(): void;
    /** Send raw JSON to WebSocket (safe wrapper) */
    private _sendRaw;
    /** Send a relay message (desktop → cloud → mobile or vice versa) */
    sendRelayMessage(type: string, payload: any, correlationId?: string): void;
    disconnectWebSocket(): void;
    queueOperation(type: string, action: string, payload: any): string;
    getQueueStats(): {
        total: number;
        pending: number;
        failed: number;
        oldestMs: number | null;
    };
    flushQueue(): Promise<{
        succeeded: number;
        failed: number;
    }>;
    isOnline(): Promise<boolean>;
    on(event: string, fn: EventListener): void;
    off(event: string, fn: EventListener): void;
    emit(event: string, data: any): void;
    disconnect(): void;
}
export {};
//# sourceMappingURL=sync-client.d.ts.map