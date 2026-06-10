import type { SecurityRule, ScanLanguage } from './types.js';
export declare class SecurityRuleLoader {
    private rules;
    private watchers;
    loadRules(projectPath: string): Promise<SecurityRule[]>;
    loadCustomRules(projectPath: string): Promise<void>;
    startFileWatcher(projectPath: string): void;
    getRulesForLanguage(language: ScanLanguage): SecurityRule[];
    getRules(): SecurityRule[];
    dispose(): void;
}
//# sourceMappingURL=rule-loader.d.ts.map