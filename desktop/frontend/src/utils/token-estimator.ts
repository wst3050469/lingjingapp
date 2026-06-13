// Browser-safe token estimation utility
// Ported from src/core/token-counter.ts - character-based heuristic

import type { ChatMessage } from '../stores/chat-store';

/**
 * Estimate token count for a text string.
 * ~4 chars per token for ASCII, ~1.5 chars per token for CJK/non-ASCII.
 */
export function estimateTokens(text: string | null | undefined): number {
  // Defensive: guard against undefined/null/empty content from malformed DB rows or events
  if (!text) return 0;

  let asciiChars = 0;
  let nonAsciiChars = 0;

  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) <= 127) {
      asciiChars++;
    } else {
      nonAsciiChars++;
    }
  }

  return Math.ceil(asciiChars / 4 + nonAsciiChars / 1.5);
}

/**
 * Estimate total tokens for a conversation's messages.
 * Includes message content, tool call args/results, and per-message overhead.
 */
export function estimateConversationTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += 4; // message overhead (role, separators)
    total += estimateTokens(msg.content);
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        total += estimateTokens(tc.name);
        total += estimateTokens(JSON.stringify(tc.args ?? {}));
        if (tc.result) {
          total += estimateTokens(tc.result.content);
        }
      }
    }
  }
  return total;
}
