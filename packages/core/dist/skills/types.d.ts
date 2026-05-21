export interface SkillConfig {
    name: string;
    description: string;
    triggers: string[];
    tools: string[];
    instructions: string;
    level: 'user' | 'project' | 'auto-generated';
    path: string;
}
export interface SkillCatalogEntry {
    name: string;
    description: string;
    triggers: string[];
    level: 'user' | 'project' | 'auto-generated';
    path: string;
}
export interface SkillInjection {
    skillName: string;
    instructions: string;
    injectedAt: Date;
}
//# sourceMappingURL=types.d.ts.map