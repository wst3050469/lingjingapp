import { SecurityRuleLoader } from './rule-loader.js';
import type { Vulnerability, ScanResult, ScanScope } from './types.js';
export interface ScanProgress {
    phase: string;
    current: number;
    total: number;
    filePath?: string;
}
export declare class SecurityScanner {
    private ruleLoader;
    private aborted;
    constructor();
    scan(projectPath: string, scope?: ScanScope, specifiedFiles?: string[], onProgress?: (progress: ScanProgress) => void): Promise<ScanResult>;
    scanFile(filePath: string, projectPath: string): Promise<Vulnerability[]>;
    private resolveScanFiles;
    cancel(): void;
    getRuleLoader(): SecurityRuleLoader;
    private buildSummary;
}
//# sourceMappingURL=scanner.d.ts.map