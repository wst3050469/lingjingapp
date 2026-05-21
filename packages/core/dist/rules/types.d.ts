export type RuleType = 'manual' | 'model' | 'always' | 'filePattern';
export interface Rule {
    id: string;
    name: string;
    type: RuleType;
    content: string;
    description?: string;
    filePatterns?: string;
    enabled: boolean;
    source?: 'config' | 'file' | 'agents-md';
    filePath?: string;
}
export interface RuleFileMetadata {
    name?: string;
    type?: RuleType;
    description?: string;
    filePatterns?: string;
    enabled?: boolean;
}
export interface LoadedRules {
    configRules: Rule[];
    fileRules: Rule[];
    agentsMdRule: Rule | null;
}
export interface EnhancedRule extends Rule {
    sourceFile: 'lingjingrules' | 'cursorrules';
    priority: number;
    scope: 'global' | 'project';
}
export interface MergedRuleSet {
    rules: EnhancedRule[];
    conflicts: RuleConflict[];
    source: ('lingjingrules' | 'cursorrules')[];
}
export interface RuleConflict {
    ruleA: EnhancedRule;
    ruleB: EnhancedRule;
    description: string;
    suggestion: string;
}
//# sourceMappingURL=types.d.ts.map