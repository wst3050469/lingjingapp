"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenSpaceExecuteTool = void 0;
const security_review_js_1 = require("../security-review.js");
const logger_js_1 = require("../../../utils/logger.js");
const PARAMETERS = {
    type: 'object',
    properties: {
        script: {
            type: 'string',
            description: 'Lua/JavaScript/Python script to execute in OpenSpace',
        },
        language: {
            type: 'string',
            enum: ['lua', 'javascript', 'python'],
            description: 'Script language',
        },
        timeout: {
            type: 'number',
            description: 'Execution timeout in milliseconds',
            default: 30000,
        },
        preview: {
            type: 'boolean',
            description: 'Preview mode: only run security review without execution',
            default: false,
        },
        scripts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Batch execution: array of scripts to execute sequentially',
        },
    },
    required: ['script', 'language'],
};
class OpenSpaceExecuteTool {
    name = 'openspace_execute';
    description = 'Execute OpenSpace script commands to control the universe visualization scene';
    parameters = PARAMETERS;
    riskLevel = 'medium';
    bridge = null;
    processManager = null;
    setBridge(bridge) {
        this.bridge = bridge;
    }
    setProcessManager(manager) {
        this.processManager = manager;
    }
    async execute(params, context) {
        const script = params.script;
        const language = params.language;
        const timeout = params.timeout ?? 30000;
        const preview = params.preview ?? false;
        const scripts = params.scripts;
        if (!['lua', 'javascript', 'python'].includes(language)) {
            return {
                content: `Invalid language: "${language}". Supported: lua, javascript, python`,
                isError: true,
            };
        }
        if (!this.processManager || this.processManager.runState !== 'running') {
            return {
                content: 'OpenSpace is not running, please start it first',
                isError: true,
            };
        }
        if (scripts && scripts.length > 0) {
            return this.executeBatch(scripts, language, timeout);
        }
        const securityResult = (0, security_review_js_1.reviewScript)(script, language);
        if (preview) {
            return {
                content: JSON.stringify({
                    preview: true,
                    securityReview: securityResult,
                    script,
                    language,
                }),
            };
        }
        if (!securityResult.passed) {
            const violations = securityResult.violations
                .map((v) => `  Line ${v.line}: ${v.description} (${v.riskLevel})`)
                .join('\n');
            return {
                content: `Security review failed (risk: ${securityResult.riskLevel}):\n${violations}`,
                isError: true,
            };
        }
        if (!this.bridge || !this.bridge.isConnected) {
            return {
                content: 'OpenSpace bridge is not connected',
                isError: true,
            };
        }
        try {
            const result = await this.bridge.sendScript({ script, language, timeout });
            if (!result.success) {
                logger_js_1.logger.warn(`[OpenSpaceExecuteTool] execution failed: ${result.error}`);
                return {
                    content: `Execution failed: ${result.error}`,
                    isError: true,
                };
            }
            return {
                content: JSON.stringify({
                    success: true,
                    result: result.result,
                    duration: result.duration,
                    language,
                }),
            };
        }
        catch (err) {
            return {
                content: `Execution error: ${err.message}`,
                isError: true,
            };
        }
    }
    async executeBatch(scripts, language, timeout) {
        if (!this.bridge || !this.bridge.isConnected) {
            return {
                content: 'OpenSpace bridge is not connected',
                isError: true,
            };
        }
        const results = [];
        for (const script of scripts) {
            const securityResult = (0, security_review_js_1.reviewScript)(script, language);
            if (!securityResult.passed) {
                results.push({
                    script,
                    success: false,
                    error: `Security review failed (risk: ${securityResult.riskLevel})`,
                    securityReview: securityResult,
                });
                continue;
            }
            try {
                const result = await this.bridge.sendScript({ script, language, timeout });
                results.push({
                    script,
                    success: result.success,
                    result: result.result,
                    error: result.error,
                    duration: result.duration,
                });
            }
            catch (err) {
                results.push({
                    script,
                    success: false,
                    error: err.message,
                });
            }
        }
        return {
            content: JSON.stringify({ batch: true, results, language }),
        };
    }
}
exports.OpenSpaceExecuteTool = OpenSpaceExecuteTool;
//# sourceMappingURL=openspace-execute.js.map