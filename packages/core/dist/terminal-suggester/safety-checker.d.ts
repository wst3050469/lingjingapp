import type { RiskLevel } from './types.js';
export declare class SafetyChecker {
    private patterns;
    check(command: string): {
        isDangerous: boolean;
        riskLevel: RiskLevel;
        description?: string;
    };
}
//# sourceMappingURL=safety-checker.d.ts.map