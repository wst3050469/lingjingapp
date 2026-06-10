import type { IEventBus } from '../event-bus/types.js';
import { OpenSpaceBridge } from './bridge.js';
import { OpenSpaceProcessManager } from './process-manager.js';
import type { OpenSpaceFusionConfig, ProcessRunState, HealthCheckResult } from './types.js';
import { createOpenSpaceToolSet } from './tools/index.js';
import type { OpenSpaceToolSet } from './tools/index.js';
import { logger } from '../../utils/logger.js';

const DEFAULT_FUSION_CONFIG: OpenSpaceFusionConfig = {
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

export interface OpenSpaceFusionStatus {
  initialized: boolean;
  running: boolean;
  processState: ProcessRunState;
  bridgeConnected: boolean;
  installed: boolean;
  compatible: boolean;
  health: HealthCheckResult | null;
  wsPort: number | null;
  degraded: boolean;
  platformSupported: boolean;
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
export class OpenSpaceFusionAdapter {
  private config: OpenSpaceFusionConfig;
  private eventBus: IEventBus | null;
  private processManager: OpenSpaceProcessManager;
  private bridge: OpenSpaceBridge;
  private tools: OpenSpaceToolSet | null = null;
  private initialized = false;
  private unregisterStateChange: (() => void) | null = null;
  private degraded = false;
  private platformSupported = true;
  private exitCheckTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(eventBus?: IEventBus) {
    this.config = { ...DEFAULT_FUSION_CONFIG };
    this.eventBus = eventBus ?? null;
    this.processManager = new OpenSpaceProcessManager(this.eventBus ?? undefined);
    this.bridge = new OpenSpaceBridge(this.config.bridgeConfig, this.eventBus ?? undefined);
  }

  get processManagerInstance(): OpenSpaceProcessManager {
    return this.processManager;
  }

  get bridgeInstance(): OpenSpaceBridge {
    return this.bridge;
  }

  getToolSet(): OpenSpaceToolSet | null {
    return this.tools;
  }

  /**
   * Initialize the OpenSpace fusion module.
   * Detects installation and prepares tools.
   */
  initialize(config?: Partial<OpenSpaceFusionConfig>): void {
    if (this.initialized) return;

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

    // Platform check: macOS is not supported (no OpenGL 4.6 on Apple Silicon)
    this.platformSupported = process.platform !== 'darwin';
    if (!this.platformSupported) {
      this.degraded = true;
      logger.warn('[OpenSpaceFusionAdapter] macOS is not supported (no OpenGL 4.6)');
      if (this.eventBus) {
        // @ts-ignore -- runtime event topic, not in EventTopic union
        this.eventBus.publish('openspace:health_changed', {
          healthy: false,
          reason: 'platform_unsupported',
          detail: 'macOS/Apple Silicon does not support OpenGL 4.6',
        }, 'openspace-fusion-adapter');
      }
    }

    // Check if degraded (not installed or incompatible version)
    if (this.platformSupported && (!this.processManager.installation.found || !this.processManager.installation.compatible)) {
      this.degraded = true;
    }

    // Register state change handler
    this.unregisterStateChange = this.processManager.onStateChange((state, _prev) => {
      if (state === 'running') {
        // Publish skill availability event
        if (this.eventBus) {
          // @ts-ignore -- runtime event topic, not in EventTopic union
          this.eventBus.publish(
            'openspace:skills_available' as any,
            {
              skills: ['openspace-navigation', 'openspace-scene-management', 'openspace-recording'],
              timestamp: Date.now(),
            },
            'openspace-fusion-adapter',
          );
        }

        if (this.config.autoStart) {
          this.connectBridge().catch((err) => {
            logger.warn(`[OpenSpaceFusionAdapter] auto bridge connect failed: ${err.message}`);
          });
        }
      }
      if (state !== 'running' && _prev === 'running') {
        // Publish skill unavailability event
        if (this.eventBus) {
          // @ts-ignore -- runtime event topic, not in EventTopic union
          this.eventBus.publish(
            'openspace:skills_unavailable' as any,
            {
              skills: ['openspace-navigation', 'openspace-scene-management', 'openspace-recording'],
              reason: `openspace state: ${state}`,
              timestamp: Date.now(),
            },
            'openspace-fusion-adapter',
          );
        }
      }
      if (state === 'stopped') {
        this.bridge.disconnect();
        // Schedule exit check — if process exited unexpectedly, notify within 10s
        if (this.eventBus && _prev === 'running') {
          this.scheduleExitNotification(state);
        }
      }
    });

    // Create tool set
    this.tools = createOpenSpaceToolSet(this.bridge, this.processManager);

    this.initialized = true;
    logger.info('[OpenSpaceFusionAdapter] initialized');
  }

  /**
   * Start OpenSpace process.
   */
  async start(): Promise<void> {
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
  async stop(): Promise<void> {
    this.bridge.disconnect();
    await this.processManager.stop();
  }

  /**
   * Connect the WebSocket bridge to the running OpenSpace instance.
   */
  async connectBridge(): Promise<void> {
    if (this.bridge.isConnected) return;

    const wsPort = this.processManager.getWebSocketPort();
    if (wsPort) {
      this.bridge.updateConfig({ wsPort });
    }

    await this.bridge.connect();
  }

  /**
   * Get comprehensive fusion status.
   */
  getStatus(): OpenSpaceFusionStatus {
    return {
      initialized: this.initialized,
      running: this.processManager.runState === 'running',
      processState: this.processManager.runState,
      bridgeConnected: this.bridge.isConnected,
      installed: this.processManager.installation.found,
      compatible: this.processManager.installation.compatible,
      health: this.processManager.health,
      wsPort: this.processManager.getWebSocketPort(),
      degraded: this.degraded,
      platformSupported: this.platformSupported,
    };
  }

  isDegraded(): boolean {
    return this.degraded;
  }

  isPlatformSupported(): boolean {
    return this.platformSupported;
  }

  /**
   * Schedule exit notification for crash detection (within 10 seconds).
   */
  private scheduleExitNotification(state: string): void {
    if (this.exitCheckTimer) clearTimeout(this.exitCheckTimer);
    this.exitCheckTimer = setTimeout(() => {
      if (this.eventBus) {
        // @ts-ignore -- runtime event topic, not in EventTopic union
        this.eventBus.publish('openspace:health_changed', {
          healthy: false,
          state,
          reason: 'process_exited',
          detail: 'OpenSpace process exited unexpectedly. Restart required.',
          timestamp: Date.now(),
        }, 'openspace-fusion-adapter');
      }
    }, 10000);
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    this.bridge.disconnect();
    this.processManager.stop().catch(() => { /* ignore */ });

    if (this.unregisterStateChange) {
      this.unregisterStateChange();
      this.unregisterStateChange = null;
    }

    if (this.exitCheckTimer) {
      clearTimeout(this.exitCheckTimer);
      this.exitCheckTimer = null;
    }

    this.initialized = false;
    this.tools = null;
    logger.info('[OpenSpaceFusionAdapter] disposed');
  }
}
