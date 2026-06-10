// Prompt Polish IPC - AI-powered prompt enhancement
// Follows compact-ipc.ts pattern: lazy provider init + direct provider.chat()

import { ipcMain } from 'electron';
import {
  loadConfig,
  createProvider,
  type LLMProvider,
  type ChatRequest,
} from '@codepilot/core';

let polishProvider: LLMProvider | null = null;
let currentAbort: AbortController | null = null;

const POLISH_SYSTEM_PROMPT = `You are a professional prompt engineering expert. Your task is to improve user prompts to make them more effective for AI coding assistants.

Rules:
1. Preserve the original intent, core request, and all technical details
2. Improve clarity: make instructions unambiguous and specific
3. Add structure: organize complex requests with clear sections
4. Provide context: if the user asks about code, add relevant implementation details
5. Keep it concise: remove redundancy while preserving all key information
6. Only output the polished prompt text, no explanations or meta-commentary
7. Do NOT change the language of the original prompt (if it's Chinese, keep it Chinese)
8. If the original prompt is already clear and well-structured, only make minimal improvements`;

async function ensureProvider(): Promise<LLMProvider> {
  if (!polishProvider) {
    const { config } = await loadConfig();
    polishProvider = createProvider(config);
  }
  return polishProvider!;
}

export function registerPromptIpc(): void {
  ipcMain.handle(
    'prompt:polish',
    async (
      _event,
      { text }: { text: string }
    ): Promise<{ polished: string; error: string | null }> => {
      // Abort any previous polish
      if (currentAbort) {
        currentAbort.abort();
      }
      currentAbort = new AbortController();
      const signal = currentAbort.signal;

      // Skip very short prompts (no meaningful polish needed)
      if (!text || text.trim().length < 5) {
        return { polished: text, error: null };
      }

      try {
        const provider = await ensureProvider();

        const request: ChatRequest = {
          messages: [
            {
              role: 'user',
              content: `Please polish and improve the following prompt:\n\n${text}`,
            },
          ],
          systemPrompt: POLISH_SYSTEM_PROMPT,
          maxTokens: 2048,
          temperature: 0.4,
          signal,
        };

        let polished = '';
        for await (const event of provider.chat(request)) {
          if (signal.aborted) break;
          if (event.type === 'text_delta') {
            polished += event.text;
          }
        }

        // If the result is empty or just whitespace, fall back to original
        if (!polished || !polished.trim()) {
          return { polished: text, error: 'AI returned empty result' };
        }

        return { polished: polished.trim(), error: null };
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) {
          return { polished: text, error: null };
        }
        console.error('[PromptIpc] Polish error:', err);
        return { polished: text, error: err?.message || String(err) };
      } finally {
        if (currentAbort?.signal === signal) {
          currentAbort = null;
        }
      }
    }
  );
}

// Called when provider config changes
export function resetPolishProvider(): void {
  polishProvider = null;
}
