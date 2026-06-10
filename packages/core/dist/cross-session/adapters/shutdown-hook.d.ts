import type { GracefulShutdown } from '../../lifecycle/graceful-shutdown.js';
import type { ContextPersistor } from '../context-persistor.js';
import type { ContextSnapshot } from '../types.js';
export declare class ShutdownHook {
    register(shutdown: GracefulShutdown, persistor: ContextPersistor, getCurrentSnapshot: () => ContextSnapshot | null): void;
}
//# sourceMappingURL=shutdown-hook.d.ts.map