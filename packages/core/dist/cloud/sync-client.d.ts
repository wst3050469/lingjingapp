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
    _heartbeatTimer: ReturnType<typeof setInterval> | null;
    _desktopHeartbeatTimer: ReturnType<typeof setInterval> | null;
    listeners: Map<string, Set<EventListener>>;
    queue: OfflineQueue;
    private _autoRegisterRetries;
    private _maxAutoRegisterRetries;
    constructor(options?: CloudSyncClientOptions);
    autoRegister(): Promise<boolean>;
    private _retryAutoRegister;
    authHeaders(): Record<string, string>;
    _directRequest(method: string, path: string, body?: any): Promise<any>;
    request(method: string, path: string, body?: any): Promise<any>;
    setToken(token: string): void;
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
    healthCheck(): Promise<{
        ok: boolean;
        error?: string;
    }>;
    private _startHeartbeat;
    private _stopHeartbeat;
    private _startDesktopHeartbeat;
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
    listDesktops(): void;
    sendRelayToMobile(payload: any, correlationId?: string): void;
    sendRelayToDesktop(targetDeviceId: string, payload: any, correlationId?: string): void;
    on(event: string, fn: EventListener): void;
    off(event: string, fn: EventListener): void;
    once(event: string, fn: EventListener): void;
    emit(event: string, data: any): void;
    removeAllListeners(event?: string): void;
    disconnect(): void;
}
export {};
//# sourceMappingURL=sync-client.d.ts.map