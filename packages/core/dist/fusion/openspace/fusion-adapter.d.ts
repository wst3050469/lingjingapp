import type { IEventBus } from '../event-bus/types.js';
import { OpenSpaceBridge } from './bridge.js';
import { OpenSpaceProcessManager } from './process-manager.js';
import type { OpenSpaceFusionConfig, ProcessRunState, HealthCheckResult } from './types.js';
import type { OpenSpaceToolSet } from './tools/index.js';
export interface OpenSpaceFusionStatus {
    initialized: boolean;
    running: boolean;
    processState: ProcessRunState;
    bridgeConnected: boolean;
    installed: boolean;
    compatible: boolean;
    health: HealthCheckResult | null;
    wsPort: number | null;
}
/**
 * OpenSpaceFusionAdapter — wires OpenSpaceProcessManager and OpenSpaceBridge together.
 *
 * Responsibilities:
 * 1. Initialize ProcessManager and Bridge with shared config
 * 2. Expose unified start/stop/status API
 * 3. Register EventBus event handlers for openspace:* events
 * 4. Provide Agent tool set for AI-driven OpenSpace control
 */
export declare class OpenSpaceFusionAdapter {
    private config;
    private eventBus;
    private processManager;
    private bridge;
    private tools;
    private initialized;
    private unregisterStateChange;
    constructor(eventBus?: IEventBus);
    get processManagerInstance(): OpenSpaceProcessManager;
    get bridgeInstance(): OpenSpaceBridge;
    getToolSet(): OpenSpaceToolSet | null;
    /**
     * Initialize the OpenSpace fusion module.
     * Detects installation and prepares tools.
     */
    initialize(config?: Partial<OpenSpaceFusionConfig>): void;
    /**
     * Start OpenSpace process.
     */
    start(): Promise<void>;
    /**
     * Stop OpenSpace process and disconnect bridge.
     */
    stop(): Promise<void>;
    /**
     * Connect the WebSocket bridge to the running OpenSpace instance.
     */
    connectBridge(): Promise<void>;
    /**
     * Get comprehensive fusion status.
     */
    getStatus(): OpenSpaceFusionStatus;
    /**
     * Clean up all resources.
     */
    dispose(): void;
}
//# sourceMappingURL=fusion-adapter.d.ts.map