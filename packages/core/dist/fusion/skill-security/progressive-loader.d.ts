import type { SkillMeta } from './types.js';
interface LoadedSkill {
    metadata: SkillMeta;
    fullContent?: string;
}
export declare class ProgressiveLoader {
    private loadedSkills;
    loadMetadata(skillPath: string): Promise<SkillMeta>;
    loadFullContent(skillPath: string): Promise<string>;
    getLoadedSkills(): ReadonlyMap<string, LoadedSkill>;
    isLoaded(skillPath: string): boolean;
    private parseFrontmatter;
    private readSkillFile;
    private parseSimpleYaml;
    private extractNameFromPath;
    private defaultMeta;
}
export {};
//# sourceMappingURL=progressive-loader.d.ts.map