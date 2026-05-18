import type { IEventBus } from '../event-bus/types.js';
import type { IHookRegistry, HookPoint, HookContext } from '../hook-registry/types.js';
import { OpenSpaceBridge } from './bridge.js';
import { OpenSpaceProcessManager } from './process-manager.js';
import type { OpenSpaceFusionConfig, ProcessRunState, HealthCheckResult } from './types.js';
import { createOpenSpaceToolSet } from './tools/index.js';
import type { OpenSpaceToolSet } from './tools/index.js';
import { reviewScript } from './security-review.js';
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
}

export class OpenSpaceFusionAdapter {
  private config: OpenSpaceFusionConfig;
  private eventBus: IEventBus | null;
  private hookRegistry: IHookRegistry | null;
  private processManager: OpenSpaceProcessManager;
  private bridge: OpenSpaceBridge;
  private tools: OpenSpaceToolSet | null = null;
  private initialized = false;
  private unregisterStateChange: (() => void) | null = null;
  private hookIds: string[] = [];

  constructor(eventBus?: IEventBus, hookRegistry?: IHookRegistry) {
    this.config = { ...DEFAULT_FUSION_CONFIG };
    this.eventBus = eventBus ?? null;
    this.hookRegistry = hookRegistry ?? null;
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

    if (!this.config.enabled) {
      logger.info('[OpenSpaceFusionAdapter] module disabled');
      return;
    }

    this.bridge.updateConfig(this.config.bridgeConfig);
    this.processManager.detectInstallation();

    this.unregisterStateChange = this.processManager.onStateChange((state) => {
      if (this.eventBus) {
        this.eventBus.publish('openspace:health_changed', {
          state,
          timestamp: Date.now(),
        }, 'openspace-fusion-adapter');
      }
      if (state === 'running' && this.config.autoStart) {
        this.connectBridge().catch((err) => {
          logger.warn(`[OpenSpaceFusionAdapter] auto bridge connect failed: ${err.message}`);
        });
      }
      if (state === 'stopped') {
        this.bridge.disconnect();
      }
    });

    this.registerHooks();
    this.tools = createOpenSpaceToolSet(this.bridge, this.processManager);
    this.initialized = true;
    logger.info('[OpenSpaceFusionAdapter] initialized');
  }

  private registerHooks(): void {
    if (!this.hookRegistry) return;

    const beforeHookId = this.hookRegistry.register(
      'before_tool_execute' as HookPoint,
      (context: HookContext) => {
        if (context.data?.name !== 'openspace_execute') return context;
        const params = context.data.params as Record<string, unknown>;
        if (!params) return context;

        const script = params.script as string;
        const language = params.language as string;

        if (typeof script === 'string' && typeof language === 'string') {
          const result = reviewScript(script, language as 'lua' | 'javascript' | 'python');
          if (!result.passed) {
            context.data = {
              ...context.data,
              _blocked: true,
              _securityReview: result,
            };
          }
        }

        return context;
      },
      { priority: 10 },
    );
    this.hookIds.push(beforeHookId);

    const afterHookId = this.hookRegistry.register(
      'after_tool_execute' as HookPoint,
      (context: HookContext) => {
        if (context.data?.name !== 'openspace_execute') return context;

        if (this.eventBus) {
          this.eventBus.publish('openspace:script_executed', {
            script: context.data.params?.script,
            language: context.data.params?.language,
            result: context.data.result,
            timestamp: Date.now(),
          }, 'openspace-fusion-adapter');
        }

        return context;
      },
      { priority: 10 },
    );
    this.hookIds.push(afterHookId);
  }

  async start(): Promise<void> {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.processManager.installation.found) {
      this.processManager.detectInstallation();
    }

    await this.processManager.start(this.config.startConfig);

    const wsPort = this.processManager.getWebSocketPort();
    if (wsPort) {
      this.bridge.updateConfig({ wsPort });
    }

    await this.connectBridge();
  }

  async stop(): Promise<void> {
    this.bridge.disconnect();
    await this.processManager.stop();
  }

  async connectBridge(): Promise<void> {
    if (this.bridge.isConnected) return;

    const wsPort = this.processManager.getWebSocketPort();
    if (wsPort) {
      this.bridge.updateConfig({ wsPort });
    }

    await this.bridge.connect();
  }

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
    };
  }

  dispose(): void {
    for (const id of this.hookIds) {
      this.hookRegistry?.unregister(id);
    }
    this.hookIds = [];

    this.bridge.disconnect();
    this.processManager.stop().catch(() => { /* ignore */ });

    if (this.unregisterStateChange) {
      this.unregisterStateChange();
      this.unregisterStateChange = null;
    }

    this.initialized = false;
    this.tools = null;
    logger.info('[OpenSpaceFusionAdapter] disposed');
  }
}
