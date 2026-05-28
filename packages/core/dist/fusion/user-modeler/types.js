"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultProfile = exports.DEFAULT_USER_MODELER_CONFIG = void 0;
exports.DEFAULT_USER_MODELER_CONFIG = {
    enabled: true,
    persistInterval: 60000,
};
const createDefaultProfile = (id) => ({
    id,
    codingStyle: [],
    techStack: [],
    workflowPatterns: [],
    modelPreferences: {},
    decisionHistory: [],
    lastUpdated: Date.now(),
});
exports.createDefaultProfile = createDefaultProfile;
//# sourceMappingURL=types.js.map