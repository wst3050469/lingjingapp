// Conversation manager - message history and context window management
import { estimateTokens } from './token-counter.js';
export class Conversation {
    _messages = [];
    get messages() {
        return this._messages;
    }
    addUserMessage(content, images) {
        if (images && images.length > 0) {
            const blocks = [];
            if (content) {
                blocks.push({ type: 'text', text: content });
            }
            for (const img of images) {
                blocks.push({ type: 'image', data: img.data, mediaType: img.mediaType });
            }
            this._messages.push({ role: 'user', content: blocks });
        }
        else {
            this._messages.push({ role: 'user', content });
        }
    }
    addAssistantMessage(content, toolCalls, reasoningContent) {
        // Ensure content is never null/undefined — empty string is acceptable
        const msg = { role: 'assistant', content: content || '', toolCalls };
        if (reasoningContent) {
            msg.reasoningContent = reasoningContent;
        }
        this._messages.push(msg);
    }
    addToolResult(toolCallId, result) {
        this._messages.push({
            role: 'tool',
            toolCallId,
            content: result.content || '',
            isError: result.isError,
        });
    }
    /**
     * Get messages trimmed to fit within a token budget.
     * Strategy:
     * 1. Always keep the first user message (establishes context)
     * 2. Always keep recent messages
     * 3. Drop middle messages if over budget, inserting a truncation notice
     */
    getMessagesForLLM(maxTokens) {
        if (this._messages.length === 0)
            return [];
        const totalTokens = this.estimateTotalTokens();
        if (totalTokens <= maxTokens) {
            return [...this._messages];
        }
        // Keep first message + as many recent messages as fit
        const result = [];
        const firstMsg = this._messages[0];
        const firstMsgTokens = estimateTokens(this.messageToString(firstMsg));
        // Reserve tokens for the first message and truncation notice
        let budget = maxTokens - firstMsgTokens - 50;
        result.push(firstMsg);
        // Collect messages from the end
        const recentMessages = [];
        for (let i = this._messages.length - 1; i >= 1; i--) {
            const msg = this._messages[i];
            const tokens = estimateTokens(this.messageToString(msg));
            if (budget - tokens < 0)
                break;
            budget -= tokens;
            recentMessages.unshift(msg);
        }
        if (recentMessages.length < this._messages.length - 1) {
            const dropped = this._messages.length - 1 - recentMessages.length;
            result.push({
                role: 'user',
                content: `[Earlier conversation with ${dropped} message(s) was truncated for brevity]`,
            });
        }
        result.push(...recentMessages);
        return result;
    }
    /**
     * Check if the conversation needs compaction.
     * Returns true when estimated tokens exceed the threshold (e.g. 70% of max).
     */
    needsCompaction(maxContextTokens) {
        const totalTokens = this.estimateTotalTokens();
        const threshold = Math.floor(maxContextTokens * 0.70);
        return totalTokens > threshold && this._messages.length > 10;
    }
    /**
     * Compact the conversation by replacing old messages with a summary.
     * Keeps the most recent N messages intact and replaces everything before
     * with a single summary message.
     *
     * @param summary - The LLM-generated summary of the compacted portion
     * @param keepRecentCount - Number of recent messages to keep as-is (default: 10)
     */
    compact(summary, keepRecentCount = 10) {
        if (this._messages.length <= keepRecentCount)
            return;
        // Split messages: old part to compact + recent part to keep
        const cutIndex = this._messages.length - keepRecentCount;
        const recentMessages = this._messages.slice(cutIndex);
        // Ensure the cut doesn't split a tool_call group
        // (i.e. don't start recent with a 'tool' message that has no preceding assistant)
        let adjustedCut = cutIndex;
        while (adjustedCut > 0 && adjustedCut < this._messages.length && recentMessages[0]?.role === 'tool') {
            adjustedCut--;
            recentMessages.unshift(this._messages[adjustedCut]);
        }
        // Build new message list: summary + recent
        this._messages = [
            {
                role: 'user',
                content: `[Conversation Summary - earlier messages were automatically compressed]\n\n${summary}`,
            },
            ...recentMessages,
        ];
    }
    /**
     * Build a text representation of old messages for sending to the LLM
     * to generate a summary. Truncates tool outputs aggressively.
     *
     * @param keepRecentCount - Number of recent messages to exclude from summary source
     */
    buildCompactionSource(keepRecentCount = 10) {
        const cutIndex = Math.max(0, this._messages.length - keepRecentCount);
        const oldMessages = this._messages.slice(0, cutIndex);
        const lines = [];
        for (const msg of oldMessages) {
            const role = msg.role === 'user' ? 'User'
                : msg.role === 'assistant' ? 'Assistant'
                    : 'Tool';
            let content = Conversation.contentToText(msg.content);
            // Aggressively truncate tool outputs
            if (msg.role === 'tool') {
                content = content.length > 200 ? content.slice(0, 200) + '...(truncated)' : content;
            }
            else {
                content = content.length > 2000 ? content.slice(0, 2000) + '...(truncated)' : content;
            }
            lines.push(`[${role}]: ${content}`);
        }
        return lines.join('\n\n');
    }
    /**
     * Hydrate the conversation with previously saved messages.
     * Used for resume/restore from persisted state.
     * Ensures all messages have valid content to prevent API errors.
     */
    hydrate(messages) {
        this._messages = messages.map(msg => {
            if (Array.isArray(msg.content)) {
                return { ...msg, content: msg.content };
            }
            return { ...msg, content: msg.content || '' };
        });
    }
    clear() {
        this._messages = [];
    }
    estimateTotalTokens() {
        let total = 0;
        for (const msg of this._messages) {
            total += 4; // overhead
            total += estimateTokens(this.messageToString(msg));
        }
        return total;
    }
    /** Extract a plain-text representation of a message's content (for token estimation). */
    static contentToText(content) {
        if (typeof content === 'string')
            return content;
        // ContentBlock[] — extract text blocks only, images are opaque
        return content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    }
    messageToString(msg) {
        if (msg.role === 'assistant' && msg.toolCalls) {
            return Conversation.contentToText(msg.content) + JSON.stringify(msg.toolCalls);
        }
        return Conversation.contentToText(msg.content);
    }
}
//# sourceMappingURL=conversation.js.map