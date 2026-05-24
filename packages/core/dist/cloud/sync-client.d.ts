import { OfflineQueue } from './offline-queue.js';
import type { CloudSession, CloudMemory } from './types.js';
export interface CloudSyncClientOptions {
    url?: string;
    apiKey?: string;
    enabled?: boolean;
    deviceId?: string;
    deviceName?: string;
    userId?: string;
    isDesktop?: boolean;
}
type EventListener = (data: any) => void;
export declare class CloudSyncClient {
    url: string;
    apiKey: string;
    enabled: boolean;
    token: string | null;
    deviceId: string;
    deviceName: string;
    userId: string | null;
    isDesktop: boolean;
    ws: WebSocket | null;
    wsReconnectTimer: ReturnType<typeof setTimeout> | null;
    /** Heartbeat timer: sends ping every 30s to keep WebSocket alive */
    _heartbeatTimer: ReturnType<typeof setInterval> | null;
    /** Desktop relay heartbeat timer: sends desktop:heartbeat every 60s */
    _desktopHeartbeatTimer: ReturnType<typeof setInterval> | null;
    syncTimer: ReturnType<typeof setInterval> | null;
    listeners: Map<string, Set<EventListener>>;
    queue: OfflineQueue;
    private _online;
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
    /** Start desktop relay heartbeat: sends desktop:heartbeat every 60s */
    private _startDesktopHeartbeat;
    /** Stop desktop relay heartbeat timer */
    private _stopDesktopHeartbeat;
    connectWebSocket(): void;
    scheduleReconnect(): void;
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
    /** List online desktop devices for the current user */
    listDesktops(): void;
    /** Send relay message to mobile client */
    sendRelayToMobile(payload: any, correlationId?: string): void;
    /** Send relay message to a specific desktop device */
    sendRelayToDesktop(targetDeviceId: string, payload: any, correlationId?: string): void;
    on(event: string, fn: EventListener): void;
    off(event: string, fn: EventListener): void;
    emit(event: string, data: any): void;
    disconnect(): void;
}
export {};
//# sourceMappingURL=sync-client.d.ts.map