import { ISkillAdapter, SkillConfig } from './types.js';
export declare class SkillAdapter implements ISkillAdapter {
    readonly version = "1.0.0";
    private skills;
    private loadHandler;
    setLoadHandler(handler: (config: SkillConfig) => Promise<void>): void;
    load(config: SkillConfig): Promise<void>;
    unload(name: string): Promise<void>;
    get(name: string): SkillConfig | undefined;
    getAll(): SkillConfig[];
}
export declare function createSkillAdapter(): SkillAdapter;
//# sourceMappingURL=skill-adapter.d.ts.map