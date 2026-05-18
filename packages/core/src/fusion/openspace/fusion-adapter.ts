import type { IEventBus, EventTopic } from '../event-bus/types.js';
import type { IHookRegistry, HookPoint, HookContext } from '../hook-registry/types.js';
import { OpenSpaceBridge } from './bridge.js';
import { OpenSpaceProcessManager } from './process-manager.js';
import { OpenSpaceScriptGenerator } from './script-generator.js';
import type { GenerationResult, LLMClient } from './script-generator.js';
import { OpenSpaceProfileManager } from './profile-manager.js';
import { OpenSpaceDatasetBrowser } from './dataset-browser.js';
import type { OpenSpaceFusionConfig, ProcessRunState, HealthCheckResult, OpenSpaceProfile } from './types.js';
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
  profileLoaded: boolean;
  datasetsLoaded: number;
}

export class OpenSpaceFusionAdapter {
  private config: OpenSpaceFusionConfig;
  private eventBus: IEventBus | null;
  private hookRegistry: IHookRegistry | null;
  private processManager: OpenSpaceProcessManager;
  private bridge: OpenSpaceBridge;
  private scriptGenerator: OpenSpaceScriptGenerator;
  private profileManager: OpenSpaceProfileManager;
  private datasetBrowser: OpenSpaceDatasetBrowser;
  private tools: OpenSpaceToolSet | null = null;
  private initialized = false;
  private unregisterStateChange: (() => void) | null = null;
  private hookIds: string[] = [];

  constructor(eventBus?: IEventBus, hookRegistry?: IHookRegistry, llmClient?: LLMClient) {
    this.config = { ...DEFAULT_FUSION_CONFIG };
    this.eventBus = eventBus ?? null;
    this.hookRegistry = hookRegistry ?? null;
    this.processManager = new OpenSpaceProcessManager(this.eventBus ?? undefined);
    this.bridge = new OpenSpaceBridge(this.config.bridgeConfig, this.eventBus ?? undefined);
    this.scriptGenerator = new OpenSpaceScriptGenerator(llmClient);
    this.profileManager = new OpenSpaceProfileManager(undefined, this.bridge, this.eventBus ?? undefined);
    this.datasetBrowser = new OpenSpaceDatasetBrowser(undefined, this.bridge, this.eventBus ?? undefined);
  }

  get processManagerInstance(): OpenSpaceProcessManager {
    return this.processManager;
  }

  get bridgeInstance(): OpenSpaceBridge {
    return this.bridge;
  }

  get scriptGeneratorInstance(): OpenSpaceScriptGenerator {
    return this.scriptGenerator;
  }

  get profileManagerInstance(): OpenSpaceProfileManager {
    return this.profileManager;
  }

  get datasetBrowserInstance(): OpenSpaceDatasetBrowser {
    return this.datasetBrowser;
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
        this.eventBus.publish('openspace:health_changed' as EventTopic, {
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
        const data = context.data as any;
        if (data?.name !== 'openspace_execute') return context;
        const params = data.params as Record<string, unknown>;
        if (!params) return context;

        const script = params.script as string;
        const language = params.language as string;

        if (typeof script === 'string' && typeof language === 'string') {
          const result = reviewScript(script, language as 'lua' | 'javascript' | 'python');
          if (!result.passed) {
            context.data = {
              ...(context.data as any),
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
        const data = context.data as any;
        if (data?.name !== 'openspace_execute') return context;

        if (this.eventBus) {
          this.eventBus.publish('openspace:script_executed' as EventTopic, {
            script: data.params?.script,
            language: data.params?.language,
            result: data.result,
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
      profileLoaded: this.profileManager.presetProfiles.length > 0,
      datasetsLoaded: this.datasetBrowser['datasetsCache'].size,
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
