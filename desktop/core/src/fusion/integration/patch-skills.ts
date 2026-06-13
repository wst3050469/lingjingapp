import type { IHookRegistry, HookPoint, HookContext } from '../hook-registry/types.js';
import type { IEventBus } from '../event-bus/types.js';
import type { SecurityConfig } from '../skill-security/types.js';
import { SkillSecurityLoader } from '../skill-security/skill-security-loader.js';
import { logger } from '../../utils/logger.js';

export interface FusionSkillPaths {
  navigateSkillPath: string;
  sceneSkillPath: string;
  recordSkillPath: string;
}

const DEFAULT_SKILL_PATHS: FusionSkillPaths = {
  navigateSkillPath: '',
  sceneSkillPath: '',
  recordSkillPath: '',
};

export function registerFusionSkills(
  eventBus: IEventBus | null,
  hookRegistry: IHookRegistry | null,
  securityConfig?: Partial<SecurityConfig>,
  skillPaths?: Partial<FusionSkillPaths>,
): {
  securityLoader: SkillSecurityLoader | null;
  skillPaths: FusionSkillPaths;
} {
  const paths = { ...DEFAULT_SKILL_PATHS, ...skillPaths };

  let securityLoader: SkillSecurityLoader | null = null;

  if (hookRegistry && eventBus) {
    securityLoader = new SkillSecurityLoader(securityConfig);
    securityLoader.initialize(eventBus, hookRegistry);
    logger.info(
      '[Fusion:Skills] SkillSecurityLoader registered in before_skill_load hook (priority: -100)',
    );
    logger.info(
      '[Fusion:Skills] All skill loads will pass through security scan before loading',
    );
  } else {
    logger.warn(
      '[Fusion:Skills] HookRegistry or EventBus not available, SkillSecurityLoader not registered',
    );
  }

  return { securityLoader, skillPaths: paths };
}
