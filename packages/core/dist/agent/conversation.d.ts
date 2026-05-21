import type { Message, ToolCall, ToolResult } from './message-types.js';
export declare class Conversation {
    private _messages;
    get messages(): readonly Message[];
    addUserMessage(content: string, images?: Array<{
        data: string;
        mediaType: string;
    }>): void;
    addAssistantMessage(content: string, toolCalls?: ToolCall[], reasoningContent?: string): void;
    addToolResult(toolCallId: string, result: ToolResult): void;
    /**
     * Get messages trimmed to fit within a token budget.
     * Strategy:
     * 1. Always keep the first user message (establishes context)
     * 2. Always keep recent messages
     * 3. Drop middle messages if over budget, inserting a truncation notice
     */
    getMessagesForLLM(maxTokens: number): Message[];
    /**
     * Check if the conversation needs compaction.
     * Returns true when estimated tokens exceed the threshold (e.g. 70% of max).
     */
    needsCompaction(maxContextTokens: number): boolean;
    /**
     * Compact the conversation by replacing old messages with a summary.
     * Keeps the most recent N messages intact and replaces everything before
     * with a single summary message.
     *
     * @param summary - The LLM-generated summary of the compacted portion
     * @param keepRecentCount - Number of recent messages to keep as-is (default: 10)
     */
    compact(summary: string, keepRecentCount?: number): void;
    /**
     * Build a text representation of old messages for sending to the LLM
     * to generate a summary. Truncates tool outputs aggressively.
     *
     * @param keepRecentCount - Number of recent messages to exclude from summary source
     */
    buildCompactionSource(keepRecentCount?: number): string;
    /**
     * Hydrate the conversation with previously saved messages.
     * Used for resume/restore from persisted state.
     * Ensures all messages have valid content to prevent API errors.
     */
    hydrate(messages: Message[]): void;
    clear(): void;
    estimateTotalTokens(): number;
    /** Extract a plain-text representation of a message's content (for token estimation). */
    static contentToText(content: Message['content']): string;
    private messageToString;
}
//# sourceMappingURL=conversation.d.ts.map