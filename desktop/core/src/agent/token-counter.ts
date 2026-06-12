// Token counter - estimate token usage for context management
// Simple token estimation: ~4 chars per token for English, ~2 chars for CJK
// This is a rough estimate; for precise counting use gpt-tokenizer

import type { Message } from './message-types.js';

export function estimateTokens(text: string): number {
    // Count ASCII and non-ASCII separately
    let asciiChars = 0;
    let nonAsciiChars = 0;
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) <= 127) {
            asciiChars++;
        } else {
            nonAsciiChars++;
        }
    }
    // ~4 chars per token for ASCII, ~1.5 chars per token for CJK/non-ASCII
    return Math.ceil(asciiChars / 4 + nonAsciiChars / 1.5);
}

export function estimateMessageTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
        total += 4; // message overhead (role, separators)
        total += estimateTokens(
            typeof msg.content === 'string' ? msg.content : ''
        );
    }
    return total;
}
