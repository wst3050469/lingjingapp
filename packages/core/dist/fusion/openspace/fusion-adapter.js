"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenSpaceFusionAdapter = void 0;
const bridge_js_1 = require("./bridge.js");
const process_manager_js_1 = require("./process-manager.js");
const index_js_1 = require("./tools/index.js");
const logger_js_1 = require("../../utils/logger.js");
const DEFAULT_FUSION_CONFIG = {
    enabled: false,
    autoStart: false,
    displayMode: 'embedded',
    startConfig: {
        windowless: true,
    },
    bridgeConfig: {
        wsPort: 4680,
        wsHost: 'localhost',
        connectTimeout: 10000,
        commandTimeout: 30000,
        maxRetries: 5,
        retryDelay: 3000,
    },
};
/**
 * OpenSpaceFusionAdapter — wires OpenSpaceProcessManager and OpenSpaceBridge together.
 *
 * Responsibilities:
 * 1. Initialize ProcessManager and Bridge with shared config
 * 2. Expose unified start/stop/status API
 * 3. Register EventBus event handlers for openspace:* events
 * 4. Provide Agent tool set for AI-driven OpenSpace control
 */
class OpenSpaceFusionAdapter {
    config;
    eventBus;
    processManager;
    bridge;
    tools = null;
    initialized = false;
    unregisterStateChange = null;
    constructor(eventBus) {
        this.config = { ...DEFAULT_FUSION_CONFIG };
        this.eventBus = eventBus ?? null;
        this.processManager = new process_manager_js_1.OpenSpaceProcessManager(this.eventBus ?? undefined);
        this.bridge = new bridge_js_1.OpenSpaceBridge(this.config.bridgeConfig, this.eventBus ?? undefined);
    }
    get processManagerInstance() {
        return this.processManager;
    }
    get bridgeInstance() {
        return this.bridge;
    }
    getToolSet() {
        return this.tools;
    }
    /**
     * Initialize the OpenSpace fusion module.
     * Detects installation and prepares tools.
     */
    initialize(config) {
        if (this.initialized)
            return;
        if (config) {
            this.config = {
                ...DEFAULT_FUSION_CONFIG,
                ...config,
                startConfig: { ...DEFAULT_FUSION_CONFIG.startConfig, ...config.startConfig },
                bridgeConfig: { ...DEFAULT_FUSION_CONFIG.bridgeConfig, ...config.bridgeConfig },
            };
        }
        // Bridge config sync
        this.bridge.updateConfig(this.config.bridgeConfig);
        // Detect installation
        this.processManager.detectInstallation();
        // Register state change handler
        this.unregisterStateChange = this.processManager.onStateChange((state, _prev) => {
            if (state === 'running' && this.config.autoStart) {
                this.connectBridge().catch((err) => {
                    logger_js_1.logger.warn(`[OpenSpaceFusionAdapter] auto bridge connect failed: ${err.message}`);
                });
            }
            if (state === 'stopped') {
                this.bridge.disconnect();
            }
        });
        // Create tool set
        this.tools = (0, index_js_1.createOpenSpaceToolSet)(this.bridge, this.processManager);
        this.initialized = true;
        logger_js_1.logger.info('[OpenSpaceFusionAdapter] initialized');
    }
    /**
     * Start OpenSpace process.
     */
    async start() {
        if (!this.initialized) {
            this.initialize();
        }
        // Auto-detect if not detected yet
        if (!this.processManager.installation.found) {
            this.processManager.detectInstallation();
        }
        await this.processManager.start(this.config.startConfig);
        const wsPort = this.processManager.getWebSocketPort();
        if (wsPort) {
            this.bridge.updateConfig({ wsPort });
        }
        // Connect bridge if process started successfully
        await this.connectBridge();
    }
    /**
     * Stop OpenSpace process and disconnect bridge.
     */
    async stop() {
        this.bridge.disconnect();
        await this.processManager.stop();
    }
    /**
     * Connect the WebSocket bridge to the running OpenSpace instance.
     */
    async connectBridge() {
        if (this.bridge.isConnected)
            return;
        const wsPort = this.processManager.getWebSocketPort();
        if (wsPort) {
            this.bridge.updateConfig({ wsPort });
        }
        await this.bridge.connect();
    }
    /**
     * Get comprehensive fusion status.
     */
    getStatus() {
        return {
            initialized: this.initialized,
            running: this.processManager.runState === 'running',
            processState: this.processManager.runState,
            bridgeConnected: this.bridge.isConnected,
            installed: this.processManager.installation.found,
            compatible: this.processManager.installation.compatible,
            health: this.processManager.health,
            wsPort: this.processManager.getWebSocketPort(),
        };
    }
    /**
     * Clean up all resources.
     */
    dispose() {
        this.bridge.disconnect();
        this.processManager.stop().catch(() => { });
        if (this.unregisterStateChange) {
            this.unregisterStateChange();
            this.unregisterStateChange = null;
        }
        this.initialized = false;
        this.tools = null;
        logger_js_1.logger.info('[OpenSpaceFusionAdapter] disposed');
    }
}
exports.OpenSpaceFusionAdapter = OpenSpaceFusionAdapter;
//# sourceMappingURL=fusion-adapter.js.map