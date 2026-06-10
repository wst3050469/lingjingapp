import { CircuitBreaker } from '../circuit-breaker.js';
import { logger } from '../../utils/logger.js';
const WS_OPEN = 1;
const WS_CLOSED = 3;
const DEFAULT_CONFIG = {
    wsPort: 4680,
    wsHost: 'localhost',
    connectTimeout: 10000,
    commandTimeout: 30000,
    maxRetries: 5,
    retryDelay: 3000,
};
export class OpenSpaceBridge {
    config;
    ws = null;
    wsFactory;
    nextId = 1;
    pendingRequests = new Map();
    commandQueue = [];
    processing = false;
    retryCount = 0;
    reconnectTimer = null;
    connected = false;
    circuitBreaker;
    eventBus;
    propertySubscriptions = new Map();
    constructor(config, eventBus, wsFactory) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.eventBus = eventBus ?? null;
        this.wsFactory = wsFactory ?? null;
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 5,
            resetTimeoutMs: 30000,
            halfOpenMaxAttempts: 1,
        });
    }
    get isConnected() {
        return this.connected && this.ws !== null && this.ws.readyState === WS_OPEN;
    }
    get circuitState() {
        return this.circuitBreaker.currentState;
    }
    async connect() {
        if (this.isConnected)
            return;
        if (!this.wsFactory)
            throw new Error('WebSocket factory not injected');
        return new Promise((resolve, reject) => {
            const url = `ws://${this.config.wsHost}:${this.config.wsPort}`;
            logger.info(`[OpenSpaceBridge] connecting to ${url}`);
            try {
                this.ws = this.wsFactory(url);
            }
            catch (err) {
                reject(new Error(`WebSocket creation failed: ${err.message}`));
                return;
            }
            const ws = this.ws;
            const connectTimer = setTimeout(() => {
                this.cleanup();
                reject(new Error(`Connection timeout after ${this.config.connectTimeout}ms`));
            }, this.config.connectTimeout);
            ws.on('open', () => {
                clearTimeout(connectTimer);
                this.connected = true;
                this.retryCount = 0;
                logger.info('[OpenSpaceBridge] connected');
                resolve();
            });
            ws.on('message', (data) => {
                this.handleMessage(data);
            });
            ws.on('close', () => {
                clearTimeout(connectTimer);
                this.handleDisconnect();
            });
            ws.on('error', (err) => {
                clearTimeout(connectTimer);
                logger.error(`[OpenSpaceBridge] ws error: ${err.message}`);
                this.handleDisconnect();
            });
        });
    }
    disconnect() {
        this.stopReconnect();
        this.cleanup();
        this.connected = false;
        logger.info('[OpenSpaceBridge] disconnected');
    }
    cleanup() {
        if (this.ws) {
            try {
                this.ws.close();
            }
            catch { /* ignore */ }
            this.ws = null;
        }
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();
    }
    handleDisconnect() {
        if (!this.connected)
            return;
        this.connected = false;
        this.retryCount++;
        if (this.eventBus) {
            this.eventBus.publish('openspace:sync_disconnected', { retryCount: this.retryCount }, 'openspace-bridge');
        }
        if (this.retryCount <= this.config.maxRetries) {
            const delay = this.config.retryDelay * Math.pow(2, this.retryCount - 1);
            logger.info(`[OpenSpaceBridge] reconnecting in ${delay}ms (attempt ${this.retryCount}/${this.config.maxRetries})`);
            this.reconnectTimer = setTimeout(() => {
                this.connect().catch((err) => {
                    logger.warn(`[OpenSpaceBridge] reconnect failed: ${err.message}`);
                });
            }, delay);
        }
        else {
            logger.error('[OpenSpaceBridge] max retries exceeded');
        }
    }
    stopReconnect() {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.retryCount = 0;
    }
    async sendScript(request) {
        if (!this.isConnected) {
            return { success: false, error: 'Not connected to OpenSpace', duration: 0 };
        }
        return new Promise((resolve, reject) => {
            this.commandQueue.push({ request, resolve, reject });
            this.processQueue();
        });
    }
    async processQueue() {
        if (this.processing || this.commandQueue.length === 0)
            return;
        this.processing = true;
        while (this.commandQueue.length > 0) {
            const item = this.commandQueue.shift();
            try {
                const result = await this.executeCommand(item.request);
                item.resolve(result);
            }
            catch (err) {
                item.reject(err);
            }
        }
        this.processing = false;
    }
    async executeCommand(request) {
        const timeout = request.timeout ?? this.config.commandTimeout;
        const start = Date.now();
        try {
            const result = await this.circuitBreaker.execute(async () => {
                const id = this.nextId++;
                const method = this.getScriptMethod(request.language);
                const message = {
                    jsonrpc: '2.0',
                    id,
                    method,
                    params: { script: request.script },
                };
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(() => {
                        this.pendingRequests.delete(id);
                        reject(new Error(`Command timeout after ${timeout}ms`));
                    }, timeout);
                    this.pendingRequests.set(id, { resolve, reject, timer });
                    this.ws.send(JSON.stringify(message));
                });
            });
            const duration = Date.now() - start;
            if (this.eventBus) {
                this.eventBus.publish('openspace:script_executed', {
                    script: request.script,
                    language: request.language,
                    duration,
                    success: true,
                }, 'openspace-bridge');
            }
            return { success: true, result, duration };
        }
        catch (err) {
            const duration = Date.now() - start;
            const errorMsg = err.message;
            if (this.eventBus) {
                this.eventBus.publish('openspace:script_failed', {
                    script: request.script,
                    language: request.language,
                    duration,
                    error: errorMsg,
                }, 'openspace-bridge');
            }
            return { success: false, error: errorMsg, duration };
        }
    }
    getScriptMethod(language) {
        switch (language) {
            case 'lua': return 'openspace.script.run';
            case 'javascript': return 'openspace.script.runjs';
            case 'python': return 'openspace.script.runpython';
        }
    }
    handleMessage(raw) {
        let message;
        try {
            const text = typeof raw === 'string' ? raw : raw.toString();
            message = JSON.parse(text);
        }
        catch {
            logger.warn('[OpenSpaceBridge] failed to parse message');
            return;
        }
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
            const pending = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);
            clearTimeout(pending.timer);
            if (message.error) {
                pending.reject(new Error(message.error.message));
            }
            else {
                pending.resolve(message.result);
            }
            return;
        }
        if (message.method) {
            this.handleEventMessage(message);
        }
    }
    handleEventMessage(message) {
        const method = message.method;
        const params = message.params ?? {};
        if (method === 'openspace.event.propertyChanged') {
            const uri = params.uri;
            const value = params.value;
            if (uri) {
                const subs = this.propertySubscriptions.get(uri);
                if (subs) {
                    for (const cb of subs) {
                        try {
                            cb(value);
                        }
                        catch { /* ignore */ }
                    }
                }
            }
            if (this.eventBus) {
                this.eventBus.publish('openspace:property_changed', params, 'openspace-bridge');
            }
            return;
        }
        if (method === 'openspace.event.sceneChanged') {
            if (this.eventBus) {
                this.eventBus.publish('openspace:scene_changed', params, 'openspace-bridge');
            }
            return;
        }
        if (method.startsWith('openspace.event.')) {
            logger.debug(`[OpenSpaceBridge] event: ${method}`, params);
        }
    }
    subscribeProperty(uri, callback) {
        if (!this.propertySubscriptions.has(uri)) {
            this.propertySubscriptions.set(uri, new Set());
        }
        this.propertySubscriptions.get(uri).add(callback);
        if (this.isConnected) {
            this.sendRawNotification('openspace.script.run', {
                script: `openspace.subscribeToProperty("${uri}")`,
            }).catch(() => { });
        }
        return () => {
            const subs = this.propertySubscriptions.get(uri);
            if (subs) {
                subs.delete(callback);
                if (subs.size === 0) {
                    this.propertySubscriptions.delete(uri);
                    if (this.isConnected) {
                        this.sendRawNotification('openspace.script.run', {
                            script: `openspace.unsubscribeFromProperty("${uri}")`,
                        }).catch(() => { });
                    }
                }
            }
        };
    }
    unsubscribeProperty(uri) {
        this.propertySubscriptions.delete(uri);
        if (this.isConnected) {
            this.sendRawNotification('openspace.script.run', {
                script: `openspace.unsubscribeFromProperty("${uri}")`,
            }).catch(() => { });
        }
    }
    async sendRawNotification(method, params) {
        if (!this.ws || this.ws.readyState !== WS_OPEN)
            return;
        const message = {
            jsonrpc: '2.0',
            id: this.nextId++,
            method,
            params,
        };
        this.ws.send(JSON.stringify(message));
    }
    async getSceneContext() {
        const luaScript = `
      return {
        currentTime = openspace.time.currentTime(),
        camera = openspace.camera.position(),
        modules = openspace.modules.loaded(),
        bodies = openspace.scene.visibleBodies()
      }
    `;
        const result = await this.sendScript({ script: luaScript, language: 'lua', timeout: 10000 });
        if (!result.success || !result.result) {
            return {
                currentTime: new Date().toISOString(),
                cameraPosition: { position: [0, 0, 0], rotation: [0, 0, 0] },
                loadedModules: [],
                activeBodies: [],
            };
        }
        return result.result;
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
//# sourceMappingURL=bridge.js.map