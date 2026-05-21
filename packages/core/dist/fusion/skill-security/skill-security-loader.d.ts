import type { IEventBus } from '../event-bus/types.js';
import type { IHookRegistry } from '../hook-registry/types.js';
import type { SecurityConfig, SecurityScanResult } from './types.js';
export declare class SkillSecurityLoader {
    private config;
    private scanner;
    private loader;
    private eventBus;
    private hookRegistry;
    constructor(config?: Partial<SecurityConfig>);
    initialize(eventBus: IEventBus, hookRegistry: IHookRegistry): void;
    scanAndLoad(skillPath: string, content: string): Promise<{
        scanResult: SecurityScanResult;
        metadata: import('./types.js').SkillMeta | null;
    }>;
    loadFullSkill(skillPath: string): Promise<string | null>;
    healthCheck(): {
        healthy: boolean;
    };
}
//# sourceMappingURL=skill-security-loader.d.ts.map