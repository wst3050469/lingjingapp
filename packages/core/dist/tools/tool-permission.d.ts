import type { RiskLevel } from './types.js';
export interface ToolGlobalPolicy {
    disabledTools: string[];
    enabledTools?: string[];
}
export interface ToolPermissionRequest {
    toolName: string;
    riskLevel: RiskLevel;
    agentAllowedTools?: string[];
}
export type PermissionResult = {
    allowed: true;
} | {
    allowed: false;
    reason: string;
    level: number;
};
export type ConfirmationHandler = (toolName: string, riskLevel: RiskLevel) => Promise<boolean>;
export declare class ToolPermission {
    private globalPolicy;
    private confirmationHandler?;
    constructor(globalPolicy: ToolGlobalPolicy, confirmationHandler?: ConfirmationHandler);
    setConfirmationHandler(handler: ConfirmationHandler): void;
    updateGlobalPolicy(policy: Partial<ToolGlobalPolicy>): void;
    check(request: ToolPermissionRequest): Promise<PermissionResult>;
}
//# sourceMappingURL=tool-permission.d.ts.map