export const DEFAULT_USER_MODELER_CONFIG = {
    enabled: true,
    persistInterval: 60000,
};
export const createDefaultProfile = (id) => ({
    id,
    codingStyle: [],
    techStack: [],
    workflowPatterns: [],
    modelPreferences: {},
    decisionHistory: [],
    lastUpdated: Date.now(),
});
//# sourceMappingURL=types.js.map