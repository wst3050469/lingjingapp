// Inline Chat IPC handler - direct LLM calls for inline code editing
// Follows the same pattern as completion-ipc.ts (no Agent pipeline, low latency)

import { ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import {
  loadConfig,
  createProvider,
  type LLMProvider,
  type ChatRequest,
} from '@codepilot/core';

let inlineChatProvider: LLMProvider | null = null;
let currentAbort: AbortController | null = null;

const INLINE_CHAT_SYSTEM_PROMPT = `You are an intelligent code editor assistant for the 灵境 IDE.
The user will describe a code modification or addition. You must return ONLY the raw code result.

Rules:
- Return ONLY the code, no explanations, no markdown fences, no comments about what you changed.
- Preserve the original indentation style.
- If modifying existing code, return the complete replacement for the selected region.
- If adding new code, return only the new code to insert.
- Do not add extra blank lines at the beginning or end unless they are part of the code structure.`;

export interface InlineChatRequest {
  prompt: string;
  filePath: string;
  language: string;
  scenario: 'modify' | 'add';
  selectedCode?: string;
  selectionRange?: { startLine: number; endLine: number; startCol: number; endCol: number };
  cursorLine?: number;
  contextFiles?: string[];
  surroundingCode: { prefix: string; suffix: string };
}

async function ensureProvider(): Promise<LLMProvider> {
  if (!inlineChatProvider) {
    const { config } = await loadConfig();
    inlineChatProvider = createProvider(config);
  }
  return inlineChatProvider;
}

function composeModifyPrompt(req: InlineChatRequest): string {
  const fileName = req.filePath.split(/[/\\]/).pop() || req.filePath;

  // Trim surrounding code for context
  const prefixLines = req.surroundingCode.prefix.split('\n').slice(-50).join('\n');
  const suffixLines = req.surroundingCode.suffix.split('\n').slice(0, 30).join('\n');

  return `File: ${fileName} (${req.language})

=== CODE BEFORE SELECTION ===
${prefixLines}

=== SELECTED CODE (lines ${req.selectionRange?.startLine ?? '?'}-${req.selectionRange?.endLine ?? '?'}) ===
${req.selectedCode}

=== CODE AFTER SELECTION ===
${suffixLines}

=== USER INSTRUCTION ===
${req.prompt}

Return ONLY the replacement code for the selected region. Do not include the surrounding code.`;
}

function composeAddPrompt(req: InlineChatRequest): string {
  const fileName = req.filePath.split(/[/\\]/).pop() || req.filePath;

  const prefixLines = req.surroundingCode.prefix.split('\n').slice(-50).join('\n');
  const suffixLines = req.surroundingCode.suffix.split('\n').slice(0, 30).join('\n');

  return `File: ${fileName} (${req.language})

=== CODE BEFORE CURSOR (cursor at line ${req.cursorLine ?? '?'}) ===
${prefixLines}

=== CODE AFTER CURSOR ===
${suffixLines}

=== USER INSTRUCTION ===
${req.prompt}

Return ONLY the new code to insert at the cursor position.`;
}

async function readContextFiles(paths: string[]): Promise<string> {
  if (!paths || paths.length === 0) return '';

  const sections: string[] = [];
  for (const filePath of paths.slice(0, 5)) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const name = filePath.split(/[/\\]/).pop() || filePath;
      // Limit each file to 3000 chars to stay within context window
      const trimmed = content.length > 3000 ? content.slice(0, 3000) + '\n... (truncated)' : content;
      sections.push(`--- ${name} ---\n${trimmed}`);
    } catch {
      // Skip files that can't be read
    }
  }

  if (sections.length === 0) return '';
  return '\n\n=== REFERENCE FILES ===\n' + sections.join('\n\n');
}

export function registerInlineChatIpc(): void {
  ipcMain.handle('inline-chat:generate', async (_event, params: InlineChatRequest) => {
    // Abort any previous request
    if (currentAbort) {
      currentAbort.abort();
    }
    currentAbort = new AbortController();
    const signal = currentAbort.signal;

    try {
      const provider = await ensureProvider();

      // Compose the prompt based on scenario
      let userMessage: string;
      if (params.scenario === 'modify') {
        userMessage = composeModifyPrompt(params);
      } else {
        userMessage = composeAddPrompt(params);
      }

      // Append context files if any
      const contextSection = await readContextFiles(params.contextFiles ?? []);
      if (contextSection) {
        userMessage += contextSection;
      }

      const request: ChatRequest = {
        messages: [{ role: 'user', content: userMessage }],
        systemPrompt: INLINE_CHAT_SYSTEM_PROMPT,
        maxTokens: 2048,
        temperature: 0.2,
        signal,
      };

      let resultText = '';
      for await (const event of provider.chat(request)) {
        if (signal.aborted) break;
        if (event.type === 'text_delta') {
          resultText += event.text;
        }
      }

      // Clean up any markdown fences the LLM might have added
      resultText = resultText
        .replace(/^```[\w]*\n?/gm, '')
        .replace(/\n?```$/gm, '')
        .trimEnd();

      return { code: resultText, error: null };
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal.aborted) {
        return { code: '', error: null };
      }
      return { code: '', error: err?.message || String(err) };
    } finally {
      if (currentAbort?.signal === signal) {
        currentAbort = null;
      }
    }
  });

  ipcMain.handle('inline-chat:abort', async () => {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
    }
  });
}

export function resetInlineChatProvider(): void {
  inlineChatProvider = null;
}
