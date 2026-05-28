"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SECURITY_CONFIG = void 0;
exports.DEFAULT_SECURITY_CONFIG = {
    enabled: true,
    blockOnHighRisk: true,
    warnOnMediumRisk: true,
    scanRules: ['command_injection', 'path_traversal', 'privilege_escalation', 'data_leakage'],
};
//# sourceMappingURL=types.js.map