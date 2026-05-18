import { logger } from '../../utils/logger.js';
import type { IEventBus } from '../event-bus/types.js';
import type { IMemoryAdapter } from '../adapters/types.js';
import type { UserProfile, UserModelerConfig, ReflectCallback } from './types.js';
import { DEFAULT_USER_MODELER_CONFIG, createDefaultProfile } from './types.js';

export class HonchoUserModeler {
  private config: UserModelerConfig;
  private currentModel: UserProfile;
  private eventBus: IEventBus | null = null;
  private memoryAdapter: IMemoryAdapter | null = null;
  private reflectCallback: ReflectCallback | null = null;
  private persistTimer: ReturnType<typeof setInterval> | null = null;
  private healthy = true;
  private unsubMemory: (() => void) | null = null;

  constructor(
    userId: string,
    config?: Partial<UserModelerConfig>,
    eventBus?: IEventBus,
    memoryAdapter?: IMemoryAdapter,
  ) {
    this.config = { ...DEFAULT_USER_MODELER_CONFIG, ...config };
    this.currentModel = createDefaultProfile(userId);
    if (eventBus) this.eventBus = eventBus;
    if (memoryAdapter) this.memoryAdapter = memoryAdapter;
    this.startPersistInterval();
    this.subscribeMemoryEvents();
  }

  setEventBus(eventBus: IEventBus): void {
    this.eventBus = eventBus;
    this.subscribeMemoryEvents();
  }

  setMemoryAdapter(adapter: IMemoryAdapter): void {
    this.memoryAdapter = adapter;
  }

  setReflectCallback(callback: ReflectCallback): void {
    this.reflectCallback = callback;
  }

  private subscribeMemoryEvents(): void {
    if (!this.eventBus) return;
    if (this.unsubMemory) {
      this.unsubMemory();
    }
    this.unsubMemory = this.eventBus.subscribe(
      'memory:updated',
      () => {
        logger.info('[HonchoUserModeler] memory:updated event received, triggering incremental update');
      },
      {},
    );
  }

  private startPersistInterval(): void {
    if (this.persistTimer) clearInterval(this.persistTimer);
    this.persistTimer = setInterval(() => {
      this.persist().catch((err) => {
        logger.warn(`[HonchoUserModeler] persist failed: ${(err as Error).message}`);
      });
    }, this.config.persistInterval);
  }

  private async persist(): Promise<void> {
    if (!this.memoryAdapter) return;
    try {
      await this.memoryAdapter.write(
        `user_profile:${this.currentModel.id}`,
        this.currentModel,
        'user_profiles',
      );
    } catch (err) {
      logger.warn(`[HonchoUserModeler] persist error: ${(err as Error).message}`);
    }
  }

  private mergeArray(current: string[], incoming: string[]): string[] {
    const merged = [...current, ...incoming];
    return [...new Set(merged)];
  }

  private mergeObject(
    current: Record<string, string>,
    incoming: Record<string, string>,
  ): Record<string, string> {
    return { ...current, ...incoming };
  }

  private decayDecisionHistory(
    history: Array<{ decision: string; reason: string; date: string }>,
    incoming: Array<{ decision: string; reason: string; date: string }>,
  ): Array<{ decision: string; reason: string; date: string }> {
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const filtered = history.filter((entry) => {
      const entryDate = new Date(entry.date).getTime();
      return now - entryDate < maxAge;
    });
    const combined = [...filtered, ...incoming];
    const seen = new Set<string>();
    const deduped = combined.filter((entry) => {
      const key = `${entry.decision}:${entry.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return deduped.slice(-50);
  }

  private mergeIncremental(incremental: Partial<UserProfile>): void {
    const model = this.currentModel;

    if (incremental.codingStyle) {
      model.codingStyle = this.mergeArray(model.codingStyle, incremental.codingStyle);
    }
    if (incremental.techStack) {
      model.techStack = this.mergeArray(model.techStack, incremental.techStack);
    }
    if (incremental.workflowPatterns) {
      model.workflowPatterns = this.mergeArray(model.workflowPatterns, incremental.workflowPatterns);
    }
    if (incremental.modelPreferences) {
      model.modelPreferences = this.mergeObject(model.modelPreferences, incremental.modelPreferences);
    }
    if (incremental.decisionHistory) {
      model.decisionHistory = this.decayDecisionHistory(model.decisionHistory, incremental.decisionHistory);
    }

    model.lastUpdated = Date.now();
  }

  updateUserModel(incremental: Partial<UserProfile>): void {
    if (!this.config.enabled) return;
    this.mergeIncremental(incremental);
    this.eventBus?.publish('user_model:updated', this.currentModel, 'HonchoUserModeler');
    logger.info(`[HonchoUserModeler] user model updated for ${this.currentModel.id}`);
  }

  getCurrentModel(): UserProfile {
    return { ...this.currentModel };
  }

  async triggerReflection(): Promise<void> {
    if (!this.config.enabled || !this.reflectCallback) return;
    try {
      const incremental = await this.reflectCallback(this.currentModel);
      this.updateUserModel(incremental);
      logger.info('[HonchoUserModeler] reflection completed');
    } catch (err) {
      logger.warn(`[HonchoUserModeler] reflection failed: ${(err as Error).message}`);
    }
  }

  async loadPersistedModel(): Promise<void> {
    if (!this.memoryAdapter) return;
    try {
      const stored = await this.memoryAdapter.read(
        `user_profile:${this.currentModel.id}`,
        'user_profiles',
      );
      if (stored) {
        const profile = stored as UserProfile;
        this.currentModel = { ...this.currentModel, ...profile };
        logger.info(`[HonchoUserModeler] loaded persisted model for ${this.currentModel.id}`);
      }
    } catch (err) {
      logger.warn(`[HonchoUserModeler] load persisted model failed: ${(err as Error).message}`);
    }
  }

  destroy(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.unsubMemory) {
      this.unsubMemory();
      this.unsubMemory = null;
    }
  }

  healthCheck(): { healthy: boolean } {
    return { healthy: this.healthy };
  }
}
