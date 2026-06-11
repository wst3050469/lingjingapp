// Lightweight completion IPC - direct LLM calls without Agent pipeline
// Used by NEXT inline code prediction for low-latency completions

import { ipcMain } from 'electron';
import {
  loadConfig,
  createProvider,
  type LLMProvider,
  type ChatRequest,
} from '@codepilot/core';

let completionProvider: LLMProvider | null = null;
let currentAbort: AbortController | null = null;

const COMPLETION_SYSTEM_PROMPT = `You are an intelligent code completion engine for the 灵境 IDE.
Predict the next code the developer will write at the cursor position.
Return ONLY the completion text, no explanations, no markdown, no code fences.
Consider the recent changes the developer has made for context.
Keep completions concise and relevant.`;

export interface CompletionRequest {
  prefix: string;
  suffix: string;
  filePath: string;
  language: string;
  recentChanges?: Array<{
    filePath: string;
    oldText: string;
    newText: string;
  }>;
  maxTokens?: number;
}

export interface CrossFileRequest {
  changedFile: string;
  changeDescription: string;
  relatedFiles: Array<{
    filePath: string;
    content: string;
  }>;
}

async function ensureProvider(): Promise<LLMProvider> {
  if (!completionProvider) {
    const { config } = await loadConfig();
    completionProvider = createProvider(config);
  }
  return completionProvider;
}

function composeFIMPrompt(req: CompletionRequest): string {
  const fileName = req.filePath.split(/[/\\]/).pop() || req.filePath;

  let recentContext = '';
  if (req.recentChanges && req.recentChanges.length > 0) {
    const changes = req.recentChanges
      .slice(-5) // Last 5 changes
      .map((c) => {
        const name = c.filePath.split(/[/\\]/).pop() || c.filePath;
        return `- In ${name}: "${c.oldText.slice(0, 60)}" → "${c.newText.slice(0, 60)}"`;
      })
      .join('\n');
    recentContext = `\nRecent edits by developer:\n${changes}\n`;
  }

  // Take last 100 lines of prefix and first 50 lines of suffix
  const prefixLines = req.prefix.split('\n');
  const suffixLines = req.suffix.split('\n');
  const trimmedPrefix = prefixLines.slice(-100).join('\n');
  const trimmedSuffix = suffixLines.slice(0, 50).join('\n');

  return `File: ${fileName} (${req.language})
${recentContext}
===PREFIX===
${trimmedPrefix}
===CURSOR===
===SUFFIX===
${trimmedSuffix}

Complete the code at ===CURSOR===. Return ONLY the raw code to insert.`;
}

function composeCrossFilePrompt(req: CrossFileRequest): string {
  const files = req.relatedFiles
    .map((f) => {
      const name = f.filePath.split(/[/\\]/).pop() || f.filePath;
      return `--- ${name} ---\n${f.content.slice(0, 3000)}`;
    })
    .join('\n\n');

  return `A developer made this change in ${req.changedFile}:
${req.changeDescription}

Here are related files that might need updates:
${files}

For each file that needs changes, respond in this exact JSON format:
[{"filePath":"path","startLine":N,"endLine":N,"newText":"replacement"}]

If no changes needed, respond with: []`;
}

export function registerCompletionIpc(): void {
  // Inline completion request
  ipcMain.handle('completion:inline', async (_event, params: CompletionRequest) => {
    // Abort any previous request
    if (currentAbort) {
      currentAbort.abort();
    }
    currentAbort = new AbortController();
    const signal = currentAbort.signal;

    try {
      const provider = await ensureProvider();
      const userMessage = composeFIMPrompt(params);

      const request: ChatRequest = {
        messages: [{ role: 'user', content: userMessage }],
        systemPrompt: COMPLETION_SYSTEM_PROMPT,
        maxTokens: params.maxTokens ?? 256,
        temperature: 0.2,
        signal,
      };

      let completionText = '';
      for await (const event of provider.chat(request)) {
        if (signal.aborted) break;
        if (event.type === 'text_delta') {
          completionText += event.text;
        }
      }

      // Clean up any markdown fences if LLM accidentally adds them
      completionText = completionText
        .replace(/^```[\w]*\n?/gm, '')
        .replace(/\n?```$/gm, '')
        .trimEnd();

      return { text: completionText, error: null };
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal.aborted) {
        return { text: '', error: null }; // Aborted = no error
      }
      return { text: '', error: err?.message || String(err) };
    } finally {
      if (currentAbort?.signal === signal) {
        currentAbort = null;
      }
    }
  });

  // Abort current completion
  ipcMain.handle('completion:abort', async () => {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
    }
  });

  // Cross-file impact analysis
  ipcMain.handle('completion:cross-file', async (_event, params: CrossFileRequest) => {
    try {
      const provider = await ensureProvider();
      const userMessage = composeCrossFilePrompt(params);

      const request: ChatRequest = {
        messages: [{ role: 'user', content: userMessage }],
        systemPrompt: 'You are a code refactoring assistant. Analyze cross-file impacts of code changes. Respond only with JSON.',
        maxTokens: 1024,
        temperature: 0.1,
      };

      let result = '';
      for await (const event of provider.chat(request)) {
        if (event.type === 'text_delta') {
          result += event.text;
        }
      }

      // Try to parse JSON response
      try {
        const edits = JSON.parse(result.trim());
        return { edits, error: null };
      } catch {
        return { edits: [], error: null };
      }
    } catch (err: any) {
      return { edits: [], error: err?.message || String(err) };
    }
  });
}

// Called when provider config changes
export function resetCompletionProvider(): void {
  completionProvider = null;
}
