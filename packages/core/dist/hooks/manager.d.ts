import type { HookEventType, HookDefinition, HookContext } from './types.js';
export declare class HooksManager {
    private hooks;
    private configPath?;
    constructor(configPath?: string);
    register(definition: HookDefinition): void;
    unregister(name: string): boolean;
    trigger(event: HookEventType, context: HookContext): Promise<void>;
    triggerParallel(event: HookEventType, context: HookContext): Promise<void>;
    loadConfig(configPath: string): void;
    private parseConfig;
    private parseYaml;
    getHooks(event?: HookEventType): HookDefinition[];
    clear(): void;
}
export declare function createDefaultHooksManager(): HooksManager;
//# sourceMappingURL=manager.d.ts.map