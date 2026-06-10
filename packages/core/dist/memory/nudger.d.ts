import type { Conversation } from '../agent/conversation.js';
export interface NudgerConfig {
    /** Nudge every N user turns (default: 3) */
    nudgeInterval: number;
    /** Whether nudging is enabled */
    enabled: boolean;
}
/**
 * Pure analysis — does NOT call the LLM. It injects a reminder message
 * into the conversation that the agent will process on its next turn.
 */
export declare class MemoryNudger {
    private config;
    private userMessageCount;
    constructor(config?: Partial<NudgerConfig>);
    /**
     * Call after each user message is processed. Returns a nudge message
     * if it's time to remind the agent to persist memories, or null.
     */
    review(conversation: Conversation): string | null;
    /** Reset the counter (e.g., new conversation) */
    reset(): void;
}
//# sourceMappingURL=nudger.d.ts.map