import type { IHookRegistry } from '../hook-registry/types.js';
import type { IEventBus } from '../event-bus/types.js';
import type { SecurityConfig } from '../skill-security/types.js';
import { SkillSecurityLoader } from '../skill-security/skill-security-loader.js';
export interface FusionSkillPaths {
    navigateSkillPath: string;
    sceneSkillPath: string;
    recordSkillPath: string;
}
export declare function registerFusionSkills(eventBus: IEventBus | null, hookRegistry: IHookRegistry | null, securityConfig?: Partial<SecurityConfig>, skillPaths?: Partial<FusionSkillPaths>): {
    securityLoader: SkillSecurityLoader | null;
    skillPaths: FusionSkillPaths;
};
