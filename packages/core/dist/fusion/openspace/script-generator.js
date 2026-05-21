import { matchTemplate, fillTemplate } from './script-templates.js';
import { reviewScript } from './security-review.js';
import { logger } from '../../utils/logger.js';
const SYSTEM_PROMPT = `You are an expert OpenSpace Lua script generator. Generate only valid Lua code that uses the OpenSpace Lua API.

OpenSpace Lua API Reference (commonly used functions):
- openspace.setPropertyValue(uri, value) — Set a property value by URI
- openspace.getPropertyValue(uri) — Get a property value by URI
- openspace.addSceneGraphNode(identifier) — Add a scene graph node
- openspace.removeSceneGraphNode(identifier) — Remove a scene graph node
- openspace.time.setTime(isoDateString) — Set simulation time
- openspace.time.currentTime() — Get current simulation time
- openspace.time.interpolateTimeTo(date, duration) — Interpolate time to target date
- openspace.camera.position() — Get camera position
- openspace.camera.setRotation(quaternion) — Set camera rotation
- openspace.camera.goToGeo(latitude, longitude, altitude) — Go to geographic position
- openspace.navigation.setNavigationState(state) — Set navigation state
- openspace.setPropertyValue("NavigationHandler.Target", name) — Set navigation target
- openspace.setPropertyValue("NavigationHandler.Distance", dist) — Set camera distance
- openspace.setPropertyValue("NavigationHandler.FlyToTarget", true) — Fly to current target
- openspace.screenlog(text) — Log to screen
- openspace.print(text) — Print to console
- openspace.subscribeToProperty(uri) — Subscribe to property changes
- openspace.unsubscribeFromProperty(uri) — Unsubscribe from property changes

Rules:
1. Output ONLY the Lua script, no markdown, no explanation
2. Use only the API functions listed above
3. Never use os.execute, io.popen, dofile, loadfile, or any dangerous function
4. Keep scripts short and focused on a single operation
5. Use string literals for identifiers and URIs
6. Prefer setPropertyValue for property manipulation`;
const HIGH_RISK_SUGGESTIONS = {
    critical: ['This script contains critically dangerous patterns. Rewrite without shell execution or dynamic code loading.'],
    high: ['Consider using OpenSpace API functions instead of direct file system or OS operations.', 'Review the OpenSpace Lua API for safer alternatives.'],
    medium: ['This script may have unintended side effects. Verify the operations are necessary.'],
};
function defaultParamExtractor(input, template) {
    const params = {};
    const words = input.toLowerCase().split(/\s+/);
    const placeholders = template.scriptTemplate.match(/\$\{(\w+)\}/g);
    if (!placeholders)
        return params;
    const uniqueNames = [...new Set(placeholders.map((p) => p.slice(2, -1)))];
    for (const name of uniqueNames) {
        if (name === 'target') {
            const bodyNames = ['Sun', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Moon', 'Mars', 'Ceres'];
            const found = bodyNames.find((b) => words.includes(b.toLowerCase()));
            params.target = found ?? 'Earth';
        }
        else if (name === 'distance') {
            const numMatch = input.match(/(\d+\.?\d*)\s*(km|m|au|pc)?/i);
            params.distance = numMatch ? parseFloat(numMatch[1]) : 1000;
        }
        else if (name === 'date') {
            const dateMatch = input.match(/\d{4}-\d{2}-\d{2}/);
            params.date = dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];
        }
        else if (name === 'fps') {
            const fpsMatch = input.match(/(\d+)\s*fps/i);
            params.fps = fpsMatch ? parseInt(fpsMatch[1], 10) : 30;
        }
        else if (name === 'resolutionX' || name === 'resolutionY') {
            const resMatch = input.match(/(\d+)\s*x\s*(\d+)/i);
            if (resMatch) {
                params.resolutionX = parseInt(resMatch[1], 10);
                params.resolutionY = parseInt(resMatch[2], 10);
            }
            else {
                params.resolutionX = 1920;
                params.resolutionY = 1080;
            }
        }
        else if (name === 'node') {
            const nodeMatch = input.match(/["']?(\w+)["']?/);
            params.node = nodeMatch ? nodeMatch[1] : 'Default';
        }
        else if (name === 'property') {
            const propMatch = input.match(/["']([\w.]+)["']/);
            params.property = propMatch ? propMatch[1] : 'Scene';
        }
        else {
            const numVal = input.match(new RegExp(`${name}[=:\\s]+(\\w+)`, 'i'));
            params[name] = numVal ? numVal[1] : name;
        }
    }
    return params;
}
export class OpenSpaceScriptGenerator {
    llmClient;
    paramExtractor;
    generationHistory = [];
    maxHistory = 100;
    constructor(llmClient, paramExtractor) {
        this.llmClient = llmClient ?? null;
        this.paramExtractor = paramExtractor ?? defaultParamExtractor;
    }
    async generate(naturalLanguage, sceneContext) {
        const template = matchTemplate(naturalLanguage);
        if (template) {
            return this.generateFromTemplate(naturalLanguage, template, sceneContext);
        }
        return this.generateFromLLM(naturalLanguage, sceneContext);
    }
    async generateFromTemplate(input, template, sceneContext) {
        const params = this.paramExtractor(input, template);
        const script = fillTemplate(template, params);
        const reviewResult = reviewScript(script, template.language);
        const result = {
            script,
            language: template.language,
            source: 'template',
            reviewResult,
            confidence: 0.9,
        };
        if (!reviewResult.passed) {
            result.error = `Security review failed: ${reviewResult.riskLevel}`;
            result.suggestions = HIGH_RISK_SUGGESTIONS[reviewResult.riskLevel] ?? [];
            result.confidence = 0.3;
        }
        this.addToHistory(input, result);
        logger.info(`[ScriptGenerator] template match: ${template.name}, confidence: ${result.confidence}`);
        return result;
    }
    async generateFromLLM(input, sceneContext) {
        if (!this.llmClient) {
            const fallback = {
                script: `openspace.screenlog("LLM not available: ${input.replace(/"/g, '\\"')}")`,
                language: 'lua',
                source: 'llm',
                reviewResult: { passed: true, riskLevel: 'none', violations: [] },
                confidence: 0.1,
                error: 'LLM client not configured',
            };
            this.addToHistory(input, fallback);
            return fallback;
        }
        const userPrompt = this.buildUserPrompt(input, sceneContext);
        try {
            const rawOutput = await this.llmClient.generate(userPrompt, SYSTEM_PROMPT);
            const script = this.sanitizeLLMOutput(rawOutput);
            const reviewResult = reviewScript(script, 'lua');
            const result = {
                script,
                language: 'lua',
                source: 'llm',
                reviewResult,
                confidence: 0.7,
            };
            if (!reviewResult.passed) {
                result.error = `Security review failed: ${reviewResult.riskLevel}`;
                result.suggestions = HIGH_RISK_SUGGESTIONS[reviewResult.riskLevel] ?? [];
                result.confidence = 0.2;
                if (reviewResult.riskLevel === 'critical' || reviewResult.riskLevel === 'high') {
                    result.script = `openspace.screenlog("Blocked: script failed security review")`;
                    result.error = `Generated script blocked due to ${reviewResult.riskLevel} risk level`;
                    result.suggestions = [
                        'The LLM generated dangerous code patterns.',
                        'Try rephrasing your request with more specific OpenSpace API terms.',
                        ...HIGH_RISK_SUGGESTIONS[reviewResult.riskLevel],
                    ];
                    result.confidence = 0.0;
                }
            }
            this.addToHistory(input, result);
            logger.info(`[ScriptGenerator] LLM generation, confidence: ${result.confidence}`);
            return result;
        }
        catch (err) {
            const errorResult = {
                script: `openspace.screenlog("Generation error: ${err.message.replace(/"/g, '\\"')}")`,
                language: 'lua',
                source: 'llm',
                reviewResult: { passed: true, riskLevel: 'none', violations: [] },
                confidence: 0.0,
                error: `LLM generation failed: ${err.message}`,
            };
            this.addToHistory(input, errorResult);
            logger.error(`[ScriptGenerator] LLM error: ${err.message}`);
            return errorResult;
        }
    }
    buildUserPrompt(input, sceneContext) {
        let prompt = `Generate an OpenSpace Lua script for the following request:\n${input}`;
        if (sceneContext) {
            prompt += `\n\nCurrent scene context:`;
            prompt += `\n- Time: ${sceneContext.currentTime}`;
            prompt += `\n- Camera position: [${sceneContext.cameraPosition.position.join(', ')}]`;
            prompt += `\n- Camera rotation: [${sceneContext.cameraPosition.rotation.join(', ')}]`;
            if (sceneContext.loadedModules.length > 0) {
                prompt += `\n- Loaded modules: ${sceneContext.loadedModules.join(', ')}`;
            }
            if (sceneContext.activeBodies.length > 0) {
                prompt += `\n- Active bodies: ${sceneContext.activeBodies.join(', ')}`;
            }
        }
        return prompt;
    }
    sanitizeLLMOutput(raw) {
        let script = raw.trim();
        const markdownBlock = script.match(/```(?:lua)?\s*\n([\s\S]*?)\n```/);
        if (markdownBlock) {
            script = markdownBlock[1].trim();
        }
        script = script.replace(/^```(?:lua)?\s*/m, '').replace(/\n?```\s*$/m, '');
        const lines = script.split('\n');
        const codeLines = lines.filter((line) => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith('--') && !trimmed.startsWith('//');
        });
        return codeLines.join('\n');
    }
    addToHistory(input, result) {
        this.generationHistory.push({ input, result, timestamp: Date.now() });
        if (this.generationHistory.length > this.maxHistory) {
            this.generationHistory.shift();
        }
    }
    getHistory() {
        return this.generationHistory;
    }
    clearHistory() {
        this.generationHistory = [];
    }
}
//# sourceMappingURL=script-generator.js.map