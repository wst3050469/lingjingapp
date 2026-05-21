// Memory Nudger — proactively reminds the agent to record important information
//
// Inspired by Hermes Agent's periodic memory nudges. After significant turns,
// the nudger prompts the agent to review and persist useful knowledge.
//
// Layer 2 of the 3-layer memory evolution system:
//   L1: Passive (update_memory tool calls by agent) ✅ existing
//   L2: Proactive nudging ✨ THIS MODULE
//   L3: Periodic reflection (MemoryReflector) ✨ reflector.ts
import { logger } from '../utils/logger.js';
const DEFAULT_NUDGER_CONFIG = {
    nudgeInterval: 3,
    enabled: true,
};
/**
 * Pure analysis — does NOT call the LLM. It injects a reminder message
 * into the conversation that the agent will process on its next turn.
 */
export class MemoryNudger {
    config;
    userMessageCount = 0;
    constructor(config = {}) {
        this.config = { ...DEFAULT_NUDGER_CONFIG, ...config };
    }
    /**
     * Call after each user message is processed. Returns a nudge message
     * if it's time to remind the agent to persist memories, or null.
     */
    review(conversation) {
        if (!this.config.enabled)
            return null;
        this.userMessageCount++;
        if (this.userMessageCount % this.config.nudgeInterval !== 0)
            return null;
        // Count how many update_memory calls have been made
        let memoryOps = 0;
        for (const msg of conversation.messages) {
            if (msg.role === 'assistant' && 'toolCalls' in msg && Array.isArray(msg.toolCalls)) {
                for (const tc of msg.toolCalls) {
                    if (tc.name === 'update_memory')
                        memoryOps++;
                }
            }
        }
        // No nudge if agent is already recording memories frequently
        if (memoryOps >= this.userMessageCount / 2) {
            logger.debug('[MemoryNudger] Agent is already using memory tools actively, skipping nudge');
            return null;
        }
        const nudge = `[Memory Nudge] You've had ${this.userMessageCount} user interactions. Consider whether there's important information about the user's preferences, project context, or decisions that should be persisted to memory. Use update_memory tool if useful.`;
        logger.info(`[MemoryNudger] Injecting nudge at turn ${this.userMessageCount}`);
        return nudge;
    }
    /** Reset the counter (e.g., new conversation) */
    reset() {
        this.userMessageCount = 0;
    }
}
//# sourceMappingURL=nudger.js.map