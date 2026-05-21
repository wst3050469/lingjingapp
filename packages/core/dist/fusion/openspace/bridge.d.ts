import type { BridgeConfig, ScriptRequest, ScriptResult, SceneContext } from './types.js';
import type { IEventBus } from '../event-bus/types.js';
import { CircuitState } from '../circuit-breaker.js';
export interface IWebSocket {
    on(event: string, listener: (...args: unknown[]) => void): IWebSocket;
    send(data: string): void;
    close(): void;
    readonly readyState: number;
}
export interface IWebSocketFactory {
    (url: string): IWebSocket;
}
export declare class OpenSpaceBridge {
    private config;
    private ws;
    private wsFactory;
    private nextId;
    private pendingRequests;
    private commandQueue;
    private processing;
    private retryCount;
    private reconnectTimer;
    private connected;
    private circuitBreaker;
    private readonly eventBus;
    private propertySubscriptions;
    constructor(config?: Partial<BridgeConfig>, eventBus?: IEventBus, wsFactory?: IWebSocketFactory);
    get isConnected(): boolean;
    get circuitState(): CircuitState;
    connect(): Promise<void>;
    disconnect(): void;
    private cleanup;
    private handleDisconnect;
    private stopReconnect;
    sendScript(request: ScriptRequest): Promise<ScriptResult>;
    private processQueue;
    private executeCommand;
    private getScriptMethod;
    private handleMessage;
    private handleEventMessage;
    subscribeProperty(uri: string, callback: (value: unknown) => void): () => void;
    unsubscribeProperty(uri: string): void;
    private sendRawNotification;
    getSceneContext(): Promise<SceneContext>;
    updateConfig(config: Partial<BridgeConfig>): void;
}
//# sourceMappingURL=bridge.d.ts.map