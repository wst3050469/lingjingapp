// NEXT Inline Completion Provider for Monaco Editor
// Implements monaco.languages.InlineCompletionsProvider with debounced LLM calls

import type * as Monaco from 'monaco-editor';
import { useNextStore } from '../stores/next-store';

// Re-export the type for external use
export type MonacoInstance = typeof Monaco;

export class NextInlineProvider implements Monaco.languages.InlineCompletionsProvider {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentRequestId = 0;
  private monaco: MonacoInstance;

  constructor(monacoInstance: MonacoInstance) {
    this.monaco = monacoInstance;
  }

  async provideInlineCompletions(
    model: Monaco.editor.ITextModel,
    position: Monaco.Position,
    _context: Monaco.languages.InlineCompletionContext,
    token: Monaco.CancellationToken
  ): Promise<Monaco.languages.InlineCompletions> {
    const emptyResult: Monaco.languages.InlineCompletions = { items: [] };

    // 1. Check if NEXT is enabled
    const store = useNextStore.getState();
    if (!store.enabled) return emptyResult;

    // 2. Check file extension exclusions
    const uri = model.uri.toString();
    const ext = this.getExtension(uri);
    if (store.disabledExtensions.includes(ext)) return emptyResult;

    // 3. Check if we're in a comment (and comments are disabled)
    if (!store.triggerInComments && this.isInComment(model, position)) {
      return emptyResult;
    }

    // 4. Cancel previous debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // 5. Debounce: wait before requesting
    const requestId = ++this.currentRequestId;
    const debounceMs = store.debounceMs;

    const completionText = await new Promise<string>((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        // Check if this request is still valid
        if (token.isCancellationRequested || requestId !== this.currentRequestId) {
          resolve('');
          return;
        }

        // Collect context
        const prefix = model.getValueInRange({
          startLineNumber: Math.max(1, position.lineNumber - 100),
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const suffix = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 50),
          endColumn: model.getLineMaxColumn(
            Math.min(model.getLineCount(), position.lineNumber + 50)
          ),
        });

        // Get file path and language
        const filePath = uri.replace('file://', '').replace('inmemory://model/', '');
        const language = model.getLanguageId();

        // Get recent changes for context
        const recentChanges = store.recentChanges.slice(-5).map((c) => ({
          filePath: c.filePath,
          oldText: c.oldText,
          newText: c.newText,
        }));

        // Set generating state
        useNextStore.getState().setGenerating(true);

        try {
          // Abort any previous completion
          await window.electronAPI.completion.abort();

          // Request new completion
          const response = await window.electronAPI.completion.inline({
            prefix,
            suffix,
            filePath,
            language,
            recentChanges: recentChanges.length > 0 ? recentChanges : undefined,
            maxTokens: 256,
          });

          if (token.isCancellationRequested || requestId !== this.currentRequestId) {
            resolve('');
            return;
          }

          if (response.error) {
            console.warn('[NEXT] Completion error:', response.error);
            resolve('');
            return;
          }

          resolve(response.text || '');
        } catch (err) {
          console.warn('[NEXT] Completion failed:', err);
          resolve('');
        } finally {
          useNextStore.getState().setGenerating(false);
        }
      }, debounceMs);
    });

    if (!completionText || token.isCancellationRequested) {
      return emptyResult;
    }

    // Build InlineCompletionItem
    const range = new this.monaco.Range(
      position.lineNumber,
      position.column,
      position.lineNumber,
      position.column
    );

    return {
      items: [
        {
          insertText: completionText,
          range,
        },
      ],
    };
  }

  disposeInlineCompletions(_completions: any): void {}

  freeInlineCompletions(): void {
    // Cleanup - cancel any pending debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private getExtension(uri: string): string {
    const lastDot = uri.lastIndexOf('.');
    if (lastDot === -1) return '';
    return uri.substring(lastDot).toLowerCase();
  }

  private isInComment(
    model: Monaco.editor.ITextModel,
    position: Monaco.Position
  ): boolean {
    try {
      // Use Monaco's tokenization to check if cursor is inside a comment
      const lineTokens = (model as any).tokenization.getLineTokens(position.lineNumber);
      if (!lineTokens) return false;

      const tokenCount = lineTokens.getCount();
      for (let i = 0; i < tokenCount; i++) {
        const tokenStartOffset = lineTokens.getStartOffset(i);
        const tokenEndOffset =
          i + 1 < tokenCount
            ? lineTokens.getStartOffset(i + 1)
            : model.getLineLength(position.lineNumber);

        // Check if the cursor position falls within this token
        if (
          position.column - 1 >= tokenStartOffset &&
          position.column - 1 <= tokenEndOffset
        ) {
          const tokenType = lineTokens.getStandardTokenType(i);
          // StandardTokenType: 0=Other, 1=Comment, 2=String, 3=RegEx
          return tokenType === 1;
        }
      }
    } catch {
      // If tokenization is not available, assume not in comment
    }
    return false;
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.currentRequestId++;
  }
}
