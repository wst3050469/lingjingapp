"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFusionSkills = registerFusionSkills;
const skill_security_loader_js_1 = require("../skill-security/skill-security-loader.js");
const logger_js_1 = require("../../utils/logger.js");
const DEFAULT_SKILL_PATHS = {
    navigateSkillPath: 'packages/core/src/fusion/openspace/skills/navigate/SKILL.md',
    sceneSkillPath: 'packages/core/src/fusion/openspace/skills/scene/SKILL.md',
    recordSkillPath: 'packages/core/src/fusion/openspace/skills/record/SKILL.md',
};
function registerFusionSkills(eventBus, hookRegistry, securityConfig, skillPaths) {
    const paths = { ...DEFAULT_SKILL_PATHS, ...skillPaths };
    const requiredSkills = [
        { name: 'openspace-navigate', path: paths.navigateSkillPath },
        { name: 'openspace-scene', path: paths.sceneSkillPath },
        { name: 'openspace-record', path: paths.recordSkillPath },
    ];
    for (const skill of requiredSkills) {
        logger_js_1.logger.info(`[Fusion:Skills] Expecting skill "${skill.name}" at: ${skill.path}`);
    }
    logger_js_1.logger.info('[Fusion:Skills] auto-generated skill level is supported by SkillConfig.level type');
    let securityLoader = null;
    if (hookRegistry && eventBus) {
        securityLoader = new skill_security_loader_js_1.SkillSecurityLoader(securityConfig);
        securityLoader.initialize(eventBus, hookRegistry);
        logger_js_1.logger.info('[Fusion:Skills] SkillSecurityLoader registered in before_skill_load hook (priority: -100)');
        logger_js_1.logger.info('[Fusion:Skills] All skill loads will pass through security scan before loading');
    }
    else {
        logger_js_1.logger.warn('[Fusion:Skills] HookRegistry or EventBus not available, SkillSecurityLoader not registered');
    }
    return { securityLoader, skillPaths: paths };
}
//# sourceMappingURL=patch-skills.js.map