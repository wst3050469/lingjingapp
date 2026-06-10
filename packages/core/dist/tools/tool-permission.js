export class ToolPermission {
    globalPolicy;
    confirmationHandler;
    constructor(globalPolicy, confirmationHandler) {
        this.globalPolicy = globalPolicy;
        this.confirmationHandler = confirmationHandler;
    }
    setConfirmationHandler(handler) {
        this.confirmationHandler = handler;
    }
    updateGlobalPolicy(policy) {
        this.globalPolicy = { ...this.globalPolicy, ...policy };
    }
    async check(request) {
        // Level 1: Global enabled/disabled check
        if (this.globalPolicy.disabledTools.includes(request.toolName)) {
            return { allowed: false, reason: `Tool "${request.toolName}" is globally disabled`, level: 1 };
        }
        if (this.globalPolicy.enabledTools && !this.globalPolicy.enabledTools.includes(request.toolName)) {
            return { allowed: false, reason: `Tool "${request.toolName}" is not in the enabled tools list`, level: 1 };
        }
        // Level 2: Agent preset allowed list check
        if (request.agentAllowedTools && !request.agentAllowedTools.includes(request.toolName)) {
            return { allowed: false, reason: `Tool "${request.toolName}" is not allowed for this agent`, level: 2 };
        }
        // Level 3: Risk level check + user confirmation
        if (request.riskLevel === 'dangerous') {
            if (this.confirmationHandler) {
                const confirmed = await this.confirmationHandler(request.toolName, request.riskLevel);
                if (!confirmed) {
                    return { allowed: false, reason: `Dangerous tool "${request.toolName}" execution was not confirmed by user`, level: 3 };
                }
            }
        }
        if (request.riskLevel === 'moderate') {
            if (this.confirmationHandler) {
                const confirmed = await this.confirmationHandler(request.toolName, request.riskLevel);
                if (!confirmed) {
                    return { allowed: false, reason: `Moderate tool "${request.toolName}" execution was not confirmed by user`, level: 3 };
                }
            }
        }
        return { allowed: true };
    }
}
//# sourceMappingURL=tool-permission.js.map