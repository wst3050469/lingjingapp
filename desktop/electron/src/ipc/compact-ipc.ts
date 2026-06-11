// Compact Chat IPC - conversation summarization via one-shot LLM call
// Follows completion-ipc.ts pattern: lazy provider init + direct provider.chat()

import { ipcMain } from 'electron';
import {
  loadConfig,
  createProvider,
  type LLMProvider,
  type ChatRequest,
} from '@codepilot/core';

let compactProvider: LLMProvider | null = null;
let currentAbort: AbortController | null = null;

const SUMMARIZE_SYSTEM_PROMPT = `You are a conversation compression engine. Given a conversation between a user and an AI coding assistant, produce a concise summary that preserves:

1. Key technical decisions and their rationale
2. Code logic discussed (function names, file paths, architecture choices)
3. Current state of the task (what's done, what's pending)
4. Any errors encountered and their resolutions
5. User preferences and constraints expressed

Remove:
- Redundant back-and-forth dialogue
- Tool execution details (just note which tools were used and outcomes)
- Intermediate reasoning/thinking text
- Verbose code blocks (keep only signatures and key logic)

Format the summary as structured markdown with sections:
## Task Context
## Key Decisions
## Current State
## Important Code References

Keep the summary under 2000 tokens.`;

async function ensureProvider(): Promise<LLMProvider> {
  if (!compactProvider) {
    const { config } = await loadConfig();
    compactProvider = createProvider(config);
  }
  return compactProvider;
}

/**
 * Pre-compress messages before sending to the summarization LLM.
 * Tool messages with verbose results are truncated aggressively.
 */
function compressMessagesForSummary(
  messages: Array<{ role: string; content: string }>
): string {
  const lines: string[] = [];

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'Tool';

    if (msg.role === 'tool') {
      // Aggressively truncate tool output
      const truncated = msg.content.length > 200
        ? msg.content.slice(0, 200) + '...(truncated)'
        : msg.content;
      lines.push(`[${role}]: ${truncated}`);
    } else {
      // Keep user/assistant messages but cap extremely long ones
      const content = msg.content.length > 3000
        ? msg.content.slice(0, 3000) + '...(truncated)'
        : msg.content;
      lines.push(`[${role}]: ${content}`);
    }
  }

  return lines.join('\n\n');
}

function estimateTokens(text: string): number {
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

export function registerCompactIpc(): void {
  ipcMain.handle(
    'compact:summarize',
    async (
      _event,
      {
        messages,
        language,
      }: {
        messages: Array<{ role: string; content: string }>;
        language?: string;
      }
    ) => {
      // Abort any previous compaction
      if (currentAbort) {
        currentAbort.abort();
      }
      currentAbort = new AbortController();
      const signal = currentAbort.signal;

      try {
        const provider = await ensureProvider();
        const conversationText = compressMessagesForSummary(messages);

        const langInstruction = language === 'en'
          ? 'Write the summary in English.'
          : 'Write the summary in Chinese (中文).';

        const request: ChatRequest = {
          messages: [
            {
              role: 'user',
              content: `Please summarize the following conversation:\n\n${conversationText}\n\n${langInstruction}`,
            },
          ],
          systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
          maxTokens: 2048,
          temperature: 0.2,
          signal,
        };

        let summary = '';
        for await (const event of provider.chat(request)) {
          if (signal.aborted) break;
          if (event.type === 'text_delta') {
            summary += event.text;
          }
        }

        const estimatedTokens = estimateTokens(summary);

        return { summary, estimatedTokens, error: null };
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) {
          return { summary: '', estimatedTokens: 0, error: null };
        }
        return { summary: '', estimatedTokens: 0, error: err?.message || String(err) };
      } finally {
        if (currentAbort?.signal === signal) {
          currentAbort = null;
        }
      }
    }
  );
}

// Called when provider config changes
export function resetCompactProvider(): void {
  compactProvider = null;
}
