"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFusionTools = registerFusionTools;
const remember_vector_js_1 = require("../vector-memory/tools/remember-vector.js");
const recall_vector_js_1 = require("../vector-memory/tools/recall-vector.js");
const parallel_execute_js_1 = require("../multi-agent/tools/parallel-execute.js");
const dag_execute_js_1 = require("../dag-orchestrator/tools/dag-execute.js");
const logger_js_1 = require("../../utils/logger.js");
function resolveModuleToggles(modules) {
    const isModuleEnabled = (name) => modules.some((m) => m.name === name && m.enabled);
    return {
        vectorMemory: isModuleEnabled('vector_memory'),
        openspace: isModuleEnabled('openspace') || isModuleEnabled('skill_security'),
        multiAgent: isModuleEnabled('parallel_executor'),
        dagOrchestrator: isModuleEnabled('dag_engine'),
    };
}
function registerFusionTools(toolRegistry, fusionConfig, deps) {
    const registered = [];
    if (!fusionConfig.enabled) {
        logger_js_1.logger.info('[Fusion:Tools] Fusion disabled, skipping tool registration');
        return registered;
    }
    const toggles = resolveModuleToggles(fusionConfig.modules);
    if (toggles.vectorMemory && deps.vectorStore) {
        const rememberTool = (0, remember_vector_js_1.createRememberVectorTool)(deps.vectorStore);
        const recallTool = (0, recall_vector_js_1.createRecallVectorTool)(deps.vectorStore);
        toolRegistry.register(rememberTool);
        toolRegistry.register(recallTool);
        registered.push('remember_vector', 'recall_vector');
        logger_js_1.logger.info('[Fusion:Tools] Registered vector memory tools');
    }
    else if (toggles.vectorMemory) {
        logger_js_1.logger.warn('[Fusion:Tools] vectorMemory enabled but no vectorStore provided');
    }
    if (toggles.openspace && deps.openspaceTool) {
        toolRegistry.register(deps.openspaceTool);
        registered.push('openspace_execute');
        logger_js_1.logger.info('[Fusion:Tools] Registered openspace_execute tool');
    }
    if (toggles.multiAgent && deps.multiAgentExecutor) {
        const parallelTool = (0, parallel_execute_js_1.createParallelExecuteTool)(deps.multiAgentExecutor);
        toolRegistry.register(parallelTool);
        registered.push('parallel_execute');
        logger_js_1.logger.info('[Fusion:Tools] Registered parallel_execute tool');
    }
    else if (toggles.multiAgent) {
        logger_js_1.logger.warn('[Fusion:Tools] multiAgent enabled but no executor provided');
    }
    if (toggles.dagOrchestrator && deps.dagOrchestrator) {
        const dagTool = (0, dag_execute_js_1.createDagExecuteTool)(deps.dagOrchestrator);
        toolRegistry.register(dagTool);
        registered.push('dag_execute');
        logger_js_1.logger.info('[Fusion:Tools] Registered dag_execute tool');
    }
    else if (toggles.dagOrchestrator) {
        logger_js_1.logger.warn('[Fusion:Tools] dagOrchestrator enabled but no orchestrator provided');
    }
    logger_js_1.logger.info(`[Fusion:Tools] Registered ${registered.length} fusion tools: [${registered.join(', ')}]`);
    return registered;
}
//# sourceMappingURL=patch-tools.js.map