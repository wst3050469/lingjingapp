"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOpenSpaceExecuteTool = createOpenSpaceExecuteTool;
exports.createOpenSpaceQueryTool = createOpenSpaceQueryTool;
exports.createOpenSpaceToolSet = createOpenSpaceToolSet;
const logger_js_1 = require("../../../utils/logger.js");
const executeParams = {
    type: 'object',
    properties: {
        script: { type: 'string', description: 'Lua/JavaScript/Python script to execute in OpenSpace' },
        language: {
            type: 'string',
            enum: ['lua', 'javascript', 'python'],
            description: 'Script language',
            default: 'lua',
        },
        timeout: { type: 'number', description: 'Command timeout in milliseconds', default: 30000 },
    },
    required: ['script'],
};
const querySceneParams = {
    type: 'object',
    properties: {
        action: {
            type: 'string',
            enum: ['scene', 'health'],
            description: 'Query type',
            default: 'scene',
        },
    },
};
/**
 * Create the openspace_execute tool — sends a script to the connected OpenSpace instance.
 */
function createOpenSpaceExecuteTool(bridge) {
    return {
        name: 'openspace_execute',
        description: 'Execute a Lua/JavaScript/Python script in a running OpenSpace instance',
        parameters: executeParams,
        async execute(params, _context) {
            try {
                if (!bridge.isConnected) {
                    return { content: 'OpenSpace is not connected. Ensure OpenSpace is running.', isError: true };
                }
                const script = params.script;
                const language = params.language ?? 'lua';
                const timeout = params.timeout ?? 30000;
                logger_js_1.logger.info(`[OpenSpaceTool] executing ${language} script (${script.length} chars)`);
                const result = await bridge.sendScript({ script, language, timeout });
                if (result.success) {
                    return {
                        content: JSON.stringify(result.result ?? { status: 'executed' }),
                    };
                }
                return {
                    content: `Script execution failed: ${result.error ?? 'unknown error'}`,
                    isError: true,
                };
            }
            catch (err) {
                return { content: `OpenSpace execute error: ${err.message}`, isError: true };
            }
        },
    };
}
/**
 * Create the openspace_query tool — queries OpenSpace scene context or process health.
 */
function createOpenSpaceQueryTool(bridge, processManager) {
    return {
        name: 'openspace_query',
        description: 'Query OpenSpace scene context, process health status, or installation detection',
        parameters: querySceneParams,
        async execute(params, _context) {
            try {
                const action = params.action ?? 'scene';
                if (action === 'health') {
                    const health = processManager.health;
                    const installation = processManager.installation;
                    return {
                        content: JSON.stringify({
                            state: processManager.runState,
                            installed: installation.found,
                            installationPath: installation.path,
                            version: installation.version,
                            compatible: installation.compatible,
                            healthy: health?.healthy ?? false,
                            wsPort: processManager.getWebSocketPort(),
                        }, null, 2),
                    };
                }
                // Default: scene context
                if (!bridge.isConnected) {
                    return { content: 'OpenSpace is not connected.', isError: true };
                }
                const scene = await bridge.getSceneContext();
                return {
                    content: JSON.stringify(scene, null, 2),
                };
            }
            catch (err) {
                return { content: `OpenSpace query error: ${err.message}`, isError: true };
            }
        },
    };
}
/**
 * Create the full OpenSpace tool set.
 */
function createOpenSpaceToolSet(bridge, processManager) {
    return {
        openspace_execute: createOpenSpaceExecuteTool(bridge),
        openspace_query: createOpenSpaceQueryTool(bridge, processManager),
    };
}
//# sourceMappingURL=index.js.map