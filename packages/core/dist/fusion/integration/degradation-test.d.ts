export interface DegradationCheck {
    name: string;
    passed: boolean;
    description: string;
}
export interface DegradationReport {
    passed: boolean;
    checks: DegradationCheck[];
}
export declare function verifyDegradation(): DegradationReport;
