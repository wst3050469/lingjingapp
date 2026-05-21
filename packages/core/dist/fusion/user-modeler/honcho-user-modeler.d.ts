import type { IEventBus } from '../event-bus/types.js';
import type { IMemoryAdapter } from '../adapters/types.js';
import type { UserProfile, UserModelerConfig, ReflectCallback } from './types.js';
export declare class HonchoUserModeler {
    private config;
    private currentModel;
    private eventBus;
    private memoryAdapter;
    private reflectCallback;
    private persistTimer;
    private healthy;
    private unsubMemory;
    constructor(userId: string, config?: Partial<UserModelerConfig>, eventBus?: IEventBus, memoryAdapter?: IMemoryAdapter);
    setEventBus(eventBus: IEventBus): void;
    setMemoryAdapter(adapter: IMemoryAdapter): void;
    setReflectCallback(callback: ReflectCallback): void;
    private subscribeMemoryEvents;
    private startPersistInterval;
    private persist;
    private mergeArray;
    private mergeObject;
    private decayDecisionHistory;
    private mergeIncremental;
    updateUserModel(incremental: Partial<UserProfile>): void;
    getCurrentModel(): UserProfile;
    triggerReflection(): Promise<void>;
    loadPersistedModel(): Promise<void>;
    destroy(): void;
    healthCheck(): {
        healthy: boolean;
    };
}
//# sourceMappingURL=honcho-user-modeler.d.ts.map