import type { SecurityFinding, SecurityScanResult, SecurityConfig } from './types.js';
export declare class SecurityScanner {
    private config;
    constructor(config?: Partial<SecurityConfig>);
    scan(content: string, skillPath: string): SecurityScanResult;
    checkCommandInjection(content: string): SecurityFinding[];
    checkPathTraversal(content: string): SecurityFinding[];
    checkPrivilegeEscalation(content: string): SecurityFinding[];
    checkDataLeakage(content: string): SecurityFinding[];
    private determineRiskLevel;
    private determineAllowed;
}
//# sourceMappingURL=security-scanner.d.ts.map