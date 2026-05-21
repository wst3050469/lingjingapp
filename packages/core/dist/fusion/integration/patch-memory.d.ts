import type { IEventBus, UnsubscribeFn } from '../event-bus/types.js';
import type { IVectorMemoryStore } from '../vector-memory/types.js';
import type { IHonchoUserModeler } from '../user-modeler/types.js';
export interface MemoryLinkageDeps {
    vectorStore: IVectorMemoryStore;
    userModeler: IHonchoUserModeler;
}
export interface MemoryLinkageResult {
    unsubscribes: UnsubscribeFn[];
    destroy(): void;
}
export declare function setupMemoryLinkages(eventBus: IEventBus, deps: MemoryLinkageDeps): MemoryLinkageResult;
//# sourceMappingURL=patch-memory.d.ts.map