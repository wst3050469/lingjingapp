import type { SkillConfig, SkillCatalogEntry } from './types.js';
/**
 * Scan all skills directories (builtin + user + project) and return merged configs.
 * Project-level skills override user-level skills, which override built-in skills.
 */
export declare function scanAllSkills(workspace?: string): Promise<Map<string, SkillConfig>>;
/**
 * Get a single skill by name.
 */
export declare function getSkill(workspace: string | undefined, name: string): Promise<SkillConfig | undefined>;
/**
 * Get skill catalog entries (name + description only, lightweight).
 */
export declare function getSkillCatalog(workspace?: string): Promise<SkillCatalogEntry[]>;
//# sourceMappingURL=loader.d.ts.map