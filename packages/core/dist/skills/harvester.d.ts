import type { Conversation } from '../agent/conversation.js';
import type { LLMProvider } from '../llm/types.js';
export interface HarvesterConfig {
    /** Minimum number of tool calls required to trigger harvesting */
    minToolCalls: number;
    /** Minimum number of conversation turns */
    minTurns: number;
    /** Minimum conversation duration (ms) */
    minDurationMs: number;
    /** LLM provider for generating the skill (often a cheaper model) */
    provider: LLMProvider;
}
export declare class SkillHarvester {
    private config;
    constructor(config: Partial<HarvesterConfig> & {
        provider: LLMProvider;
    });
    /**
     * Decide whether a conversation is worth harvesting — i.e., did the user
     * and agent accomplish something non-trivial that might be reusable?
     */
    isSignificant(conversation: Conversation, durationMs: number): boolean;
    /**
     * Attempt to harvest a skill from a conversation.
     * Returns the skill name if created, or null if skipped.
     */
    harvest(conversation: Conversation, durationMs: number): Promise<string | null>;
    /**
     * Build a compressed conversation transcript for the harvest LLM.
     */
    private buildTranscript;
    /**
     * Call a lightweight LLM to generate the SKILL.md.
     */
    private generateSkillMd;
}
//# sourceMappingURL=harvester.d.ts.map