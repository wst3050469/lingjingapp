"use strict";
// Memory Reflector — periodic reflection and knowledge synthesis
//
// Layer 3 of the 3-layer memory evolution system.
// Periodically reads all memories, identifies patterns, extracts
// user preferences/project knowledge, and updates the Rules system.
//
// Inspired by Hermes Agent's Honcho dialectic user modeling.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryReflector = void 0;
const logger_js_1 = require("../utils/logger.js");
const REFLECTION_PROMPT = `You are a memory synthesis engine. Given a list of memories from an AI coding assistant's persistent memory, synthesize a concise user profile and project context summary.

Analyze patterns across these memories and extract:

1. **User Profile** (3-5 bullet points):
   - Coding style & preferences
   - Technology stack favorites
   - Workflow patterns
   - Common issues they encounter

2. **Project Knowledge** (3-5 bullet points):
   - Active project types
   - Architecture decisions
   - Naming conventions
   - Key file paths

3. **Decision History** (important decisions made):
   - What was chosen and why

Output in markdown. Keep it actionable — this summary will be injected into future conversations as context.`;
class MemoryReflector {
    config;
    lastReflection = 0;
    constructor(config) {
        this.config = config;
    }
    /**
     * Check if it's time to run a reflection cycle.
     */
    shouldReflect() {
        if (!this.config.enabled)
            return false;
        return Date.now() - this.lastReflection >= this.config.intervalMs;
    }
    /**
     * Run a full reflection cycle: read memories → synthesize → return profile.
     * @param memories Recent memory records to reflect on
     */
    async reflect(memories) {
        if (memories.length === 0)
            return null;
        try {
            const memoryText = memories
                .map(m => `[${m.category}/${m.scope}] ${m.title}\n${m.content.slice(0, 500)}`)
                .join('\n\n---\n\n');
            let synthesis = '';
            const stream = this.config.provider.chat({
                messages: [{
                        role: 'user',
                        content: `Synthesize these ${memories.length} memories into a user profile:\n\n${memoryText}`,
                    }],
                systemPrompt: REFLECTION_PROMPT,
                maxTokens: 1500,
                temperature: 0.4,
            });
            for await (const event of stream) {
                if (event.type === 'text_delta') {
                    synthesis += event.text;
                }
            }
            if (!synthesis || synthesis.length < 50)
                return null;
            // Extract sections
            const profileMatch = synthesis.match(/## 1\.\s*User Profile\s*\n([\s\S]*?)(?=## 2\.|$)/i) ||
                synthesis.match(/User Profile[:\s]*\n([\s\S]*?)(?=Project|Decision|$)/i);
            const projectMatch = synthesis.match(/## 2\.\s*Project Knowledge\s*\n([\s\S]*?)(?=## 3\.|$)/i) ||
                synthesis.match(/Project Knowledge[:\s]*\n([\s\S]*?)(?=Decision|$)/i);
            const decisionsMatch = synthesis.match(/## 3\.\s*Decision History\s*\n([\s\S]*?)$/i) ||
                synthesis.match(/Decision History[:\s]*\n([\s\S]*?)$/i);
            const result = {
                profile: profileMatch?.[1]?.trim() || '',
                projectKnowledge: projectMatch?.[1]?.trim() || '',
                decisions: decisionsMatch?.[1]?.trim() || '',
                fullMarkdown: synthesis.trim(),
                sourceMemoryCount: memories.length,
                reflectedAt: new Date(),
            };
            this.lastReflection = Date.now();
            logger_js_1.logger.info(`[MemoryReflector] Synthesized profile from ${memories.length} memories (${synthesis.length} chars)`);
            return result;
        }
        catch (err) {
            logger_js_1.logger.warn(`[MemoryReflector] Reflection failed: ${err instanceof Error ? err.message : String(err)}`);
            return null;
        }
    }
}
exports.MemoryReflector = MemoryReflector;
//# sourceMappingURL=reflector.js.map