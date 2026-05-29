import { DEFAULT_TRACE_HARVESTER_CONFIG } from './types.js';
const HARVEST_PROMPT = `Based on the following execution trace of tool calls, generate a reusable SKILL.md definition.
Identify the workflow pattern, give it a descriptive name, and create skill instructions.
Format as a SKILL.md with YAML frontmatter containing name, description, triggers, tools, and level fields, followed by instructions in markdown.`;
export class ExecutionTraceHarvester {
    config;
    eventBus = null;
    llmAdapter = null;
    traceBuffer = new Map();
    pendingCalls = new Map();
    sessionStartTimes = new Map();
    enabled = true;
    constructor(config) {
        this.config = { ...DEFAULT_TRACE_HARVESTER_CONFIG, ...config };
        this.enabled = this.config.enabled;
    }
    initialize(eventBus, llmAdapter) {
        this.eventBus = eventBus;
        this.llmAdapter = llmAdapter ?? null;
        this.eventBus.subscribe('agent:tool_call', (event) => {
            const data = event.data;
            if (data.sessionId && data.toolName) {
                this.onToolCall(data.sessionId, data.toolName, data.parameters ?? {});
            }
        });
        this.eventBus.subscribe('agent:tool_result', (event) => {
            const data = event.data;
            if (data.sessionId) {
                this.onToolResult(data.sessionId, data.result ?? '', data.duration ?? 0);
            }
        });
        this.eventBus.subscribe('agent:message_end', (event) => {
            const data = event.data;
            if (data.sessionId) {
                this.onMessageEnd(data.sessionId);
            }
        });
    }
    collectTrace(sessionId) {
        const steps = this.traceBuffer.get(sessionId);
        if (!steps || steps.length === 0)
            return null;
        const startTime = this.sessionStartTimes.get(sessionId) ?? steps[0].timestamp;
        const endTime = steps[steps.length - 1].timestamp;
        return {
            sessionId,
            toolCallSequence: [...steps],
            startTime,
            endTime,
            totalSteps: steps.length,
        };
    }
    async analyzeAndGenerateSkill(sessionId) {
        if (!this.enabled)
            return null;
        const trace = this.collectTrace(sessionId);
        if (!trace || trace.toolCallSequence.length < this.config.minToolCalls)
            return null;
        const duration = trace.endTime - trace.startTime;
        if (duration < this.config.minTraceDuration)
            return null;
        const patterns = this.extractWorkflowPattern(trace);
        if (!this.llmAdapter)
            return null;
        try {
            const skillContent = await this.generateSkillMd(trace, patterns);
            this.eventBus?.publish('skill:loaded', {
                name: patterns[0]?.name ?? 'auto-generated-skill',
                source: 'trace_harvester',
                content: skillContent,
            }, 'ExecutionTraceHarvester');
            return skillContent;
        }
        catch {
            return null;
        }
    }
    extractWorkflowPattern(trace) {
        const toolSequence = trace.toolCallSequence.map((s) => s.toolName);
        const patterns = [];
        const seenPatterns = new Map();
        for (let len = 2; len <= Math.min(toolSequence.length, 5); len++) {
            for (let start = 0; start <= toolSequence.length - len; start++) {
                const subSeq = toolSequence.slice(start, start + len);
                const key = subSeq.join('->');
                const existing = seenPatterns.get(key);
                if (existing !== undefined) {
                    seenPatterns.set(key, existing + 1);
                }
                else {
                    seenPatterns.set(key, 1);
                }
            }
        }
        for (const [key, frequency] of seenPatterns) {
            if (frequency >= 2) {
                const steps = key.split('->');
                patterns.push({
                    name: `pattern_${steps.join('_')}`,
                    steps,
                    frequency,
                });
            }
        }
        patterns.sort((a, b) => b.frequency - a.frequency);
        return patterns.slice(0, 5);
    }
    healthCheck() {
        return { healthy: this.enabled };
    }
    onToolCall(sessionId, toolName, parameters) {
        if (!this.sessionStartTimes.has(sessionId)) {
            this.sessionStartTimes.set(sessionId, Date.now());
        }
        this.pendingCalls.set(sessionId, {
            toolName,
            parameters,
            timestamp: Date.now(),
        });
    }
    onToolResult(sessionId, result, duration) {
        const pending = this.pendingCalls.get(sessionId);
        if (!pending)
            return;
        const step = {
            toolName: pending.toolName,
            parameters: pending.parameters,
            result,
            duration,
            timestamp: pending.timestamp,
        };
        if (!this.traceBuffer.has(sessionId)) {
            this.traceBuffer.set(sessionId, []);
        }
        this.traceBuffer.get(sessionId).push(step);
        this.pendingCalls.delete(sessionId);
    }
    async onMessageEnd(sessionId) {
        await this.analyzeAndGenerateSkill(sessionId);
        this.cleanupSession(sessionId);
    }
    cleanupSession(sessionId) {
        this.traceBuffer.delete(sessionId);
        this.pendingCalls.delete(sessionId);
        this.sessionStartTimes.delete(sessionId);
    }
    async generateSkillMd(trace, patterns) {
        if (!this.llmAdapter)
            throw new Error('LLM adapter not available');
        const traceSummary = trace.toolCallSequence
            .map((s, i) => `${i + 1}. ${s.toolName} (${s.duration}ms)`)
            .join('\n');
        const patternSummary = patterns
            .map((p) => `${p.name}: ${p.steps.join(' -> ')} (frequency: ${p.frequency})`)
            .join('\n');
        const userContent = `Execution Trace:\n${traceSummary}\n\nDetected Patterns:\n${patternSummary}`;
        const messages = [
            { role: 'user', content: userContent },
        ];
        const request = {
            messages,
            systemPrompt: HARVEST_PROMPT,
            maxTokens: 2048,
            temperature: 0.4,
        };
        let responseText = '';
        const stream = this.llmAdapter.chat(request);
        for await (const event of stream) {
            if (event.type === 'text_delta') {
                responseText += event.text;
            }
            if (event.type === 'done')
                break;
        }
        return responseText;
    }
}
//# sourceMappingURL=execution-trace-harvester.js.map