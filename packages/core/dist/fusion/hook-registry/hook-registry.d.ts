import { HookPoint, HookContext, HookCallback, HookOptions, IHookRegistry } from './types.js';
export declare class HookRegistry implements IHookRegistry {
    private hooks;
    private hookById;
    register<T>(point: HookPoint, callback: HookCallback<T>, options?: HookOptions): string;
    unregister(id: string): boolean;
    execute<T>(point: HookPoint, data: T): Promise<HookContext<T>>;
    healthCheck(): {
        healthy: boolean;
        hookCount: number;
    };
}
//# sourceMappingURL=hook-registry.d.ts.map