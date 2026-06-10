import type { IEventBus, EventMessage, UnsubscribeFn } from '../event-bus/types.js';
import type { IVectorMemoryStore } from '../vector-memory/types.js';
import type { IHonchoUserModeler, UserProfile } from '../user-modeler/types.js';
import { logger } from '../../utils/logger.js';

export interface MemoryLinkageDeps {
  vectorStore: IVectorMemoryStore;
  userModeler: IHonchoUserModeler;
}

export interface MemoryLinkageResult {
  unsubscribes: UnsubscribeFn[];
  destroy(): void;
}

export function setupMemoryLinkages(
  eventBus: IEventBus,
  deps: MemoryLinkageDeps,
): MemoryLinkageResult {
  const unsubscribes: UnsubscribeFn[] = [];
  const { vectorStore, userModeler } = deps;

  const unsubMemorySync = eventBus.subscribe(
    'memory:updated',
    async (event: EventMessage<{ id?: string; content?: string; category?: string; entries?: Array<{ id: string; content: string; category: string }> }>) => {
      try {
        const data = event.data;
        if (data.entries && Array.isArray(data.entries)) {
          await vectorStore.syncFromMemory(data.entries);
        } else if (data.id && data.content && data.category) {
          await vectorStore.syncFromMemory([
            { id: data.id, content: data.content, category: data.category },
          ]);
        }
        eventBus.publish('vector:synced', { source: 'memory:updated', timestamp: Date.now() }, 'patch-memory');
      } catch (err) {
        logger.warn(`[Fusion:Memory] vector sync failed: ${(err as Error).message}`);
      }
    },
  );
  unsubscribes.push(unsubMemorySync);
  logger.info('[Fusion:Memory] memory:updated → VectorMemoryStore.syncFromMemory linked');

  const unsubUserModel = eventBus.subscribe(
    'memory:updated',
    async (event: EventMessage<{ content?: string; category?: string }>) => {
      try {
        const data = event.data;
        if (data.category === 'user_preference' || data.category === 'workflow_pattern') {
          const incremental: Partial<UserProfile> = {};
          if (data.category === 'user_preference') {
            incremental.modelPreferences = { [data.category]: data.content ?? '' };
          }
          if (data.category === 'workflow_pattern') {
            incremental.workflowPatterns = data.content ? [data.content] : [];
          }
          userModeler.updateUserModel(incremental);
        }
        eventBus.publish('user_model:updated', { source: 'memory:updated', timestamp: Date.now() }, 'patch-memory');
      } catch (err) {
        logger.warn(`[Fusion:Memory] user model update failed: ${(err as Error).message}`);
      }
    },
  );
  unsubscribes.push(unsubUserModel);
  logger.info('[Fusion:Memory] memory:updated → HonchoUserModeler.updateUserModel linked');

  const unsubMessageEnd = eventBus.subscribe(
    'agent:message_end',
    (_event: EventMessage<unknown>) => {
      logger.debug('[Fusion:Memory] agent:message_end received; MemoryNudger handles its own triggers');
    },
  );
  unsubscribes.push(unsubMessageEnd);
  logger.info('[Fusion:Memory] agent:message_end → MemoryNudger (self-managed) linked');

  const unsubReflector = eventBus.subscribe(
    'user_model:updated',
    async (event: EventMessage<Partial<UserProfile>>) => {
      try {
        const data = event.data;
        if (data && Object.keys(data).length > 0) {
          userModeler.updateUserModel(data);
          logger.debug('[Fusion:Memory] Reflector output → user model updated');
        }
      } catch (err) {
        logger.warn(`[Fusion:Memory] reflector → user model update failed: ${(err as Error).message}`);
      }
    },
  );
  unsubscribes.push(unsubReflector);
  logger.info('[Fusion:Memory] MemoryReflector output → HonchoUserModeler.updateUserModel linked');

  return {
    unsubscribes,
    destroy(): void {
      for (const unsub of unsubscribes) {
        unsub();
      }
      unsubscribes.length = 0;
      logger.info('[Fusion:Memory] All memory linkages unsubscribed');
    },
  };
}
