// Inline Chat Controller - orchestrates the entire inline chat lifecycle
// One instance per editor. Plain TypeScript class.

import type * as Monaco from 'monaco-editor';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { InlineChatWidget } from './InlineChatWidget';
import { InlineChatDiffRenderer } from './InlineChatDiffRenderer';
import { useInlineChatStore } from '../stores/inline-chat-store';

export class InlineChatController {
  private editor: Monaco.editor.IStandaloneCodeEditor;
  private monaco: typeof Monaco;
  private filePath: string;
  private language: string;

  private diffRenderer: InlineChatDiffRenderer;

  // Widget ViewZone state
  private widgetZoneId: string | null = null;
  private widgetRoot: Root | null = null;
  private widgetDomNode: HTMLDivElement | null = null;

  // Session state
  private active = false;
  private generatedCode: string | null = null;
  private lastPrompt: string | null = null;
  private commandDisposables: Monaco.IDisposable[] = [];

  constructor(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof Monaco,
    filePath: string,
    language: string,
  ) {
    this.editor = editor;
    this.monaco = monacoInstance;
    this.filePath = filePath;
    this.language = language;
    this.diffRenderer = new InlineChatDiffRenderer(editor, monacoInstance);
  }

  updateFile(filePath: string, language: string): void {
    if (this.active) {
      this.dismiss();
    }
    this.filePath = filePath;
    this.language = language;
  }

  /**
   * Open the inline chat widget at the current selection or cursor.
   */
  open(): void {
    // If already open, dismiss first
    if (this.active) {
      this.dismiss();
    }

    const editor = this.editor;
    const model = editor.getModel();
    if (!model) return;

    const selection = editor.getSelection();
    if (!selection) return;

    const hasSelection = !selection.isEmpty();
    const scenario: 'modify' | 'add' = hasSelection ? 'modify' : 'add';
    const selectedCode = hasSelection ? model.getValueInRange(selection) : undefined;
    const selectionRange = hasSelection
      ? {
          startLine: selection.startLineNumber,
          endLine: selection.endLineNumber,
          startCol: selection.startColumn,
          endCol: selection.endColumn,
        }
      : undefined;
    const cursorLine = selection.positionLineNumber;

    // Update store
    useInlineChatStore.getState().open({
      filePath: this.filePath,
      language: this.language,
      scenario,
      selectedCode,
      selectionRange,
      cursorLine,
    });

    this.active = true;
    this.generatedCode = null;
    this.lastPrompt = null;

    // Create the input widget ViewZone
    const afterLine = hasSelection ? selection.endLineNumber : cursorLine;
    this.createWidgetViewZone(afterLine, scenario);
  }

  private createWidgetViewZone(afterLine: number, scenario: 'modify' | 'add'): void {
    // Create DOM node for the ViewZone
    this.widgetDomNode = document.createElement('div');
    this.widgetDomNode.style.zIndex = '10';

    // Get open files for @ mentions
    const getOpenFiles = () => {
      try {
        // Dynamic import to avoid circular dependency
        const editorStore = (window as any).__editorStoreForInlineChat;
        if (editorStore) {
          return editorStore.getState().openFiles.map((f: any) => ({
            path: f.path,
            name: f.path.split(/[/\\]/).pop() || f.path,
          }));
        }
      } catch {
        // ignore
      }
      return [];
    };

    // Mount React component
    this.widgetRoot = createRoot(this.widgetDomNode);
    this.renderWidget(scenario, false, getOpenFiles());

    // Add ViewZone
    this.editor.changeViewZones((accessor: any) => {
      const id = accessor.addZone({
        afterLineNumber: afterLine,
        heightInLines: 3,
        domNode: this.widgetDomNode!,
        suppressMouseDown: true,
      });
      this.widgetZoneId = id as unknown as string;
    });

    // Scroll to make the widget visible
    this.editor.revealLineInCenter(afterLine + 1);
  }

  private renderWidget(
    scenario: 'modify' | 'add',
    isGenerating: boolean,
    openFiles: Array<{ path: string; name: string }>,
  ): void {
    if (!this.widgetRoot) return;

    this.widgetRoot.render(
      createElement(InlineChatWidget, {
        scenario,
        isGenerating,
        openFiles,
        onSubmit: (prompt: string, contextFiles: string[]) => this.submit(prompt, contextFiles),
        onDismiss: () => this.dismiss(),
      }),
    );
  }

  /**
   * Submit the prompt to the LLM and process the result.
   */
  async submit(prompt: string, contextFiles: string[]): Promise<void> {
    const store = useInlineChatStore.getState();
    const model = this.editor.getModel();
    if (!model) return;

    this.lastPrompt = prompt;

    // Update UI to show loading
    store.setGenerating(true);
    this.renderWidget(store.scenario!, true, []);

    // Collect surrounding code context
    const totalLines = model.getLineCount();
    let prefix: string;
    let suffix: string;

    if (store.scenario === 'modify' && store.selectionRange) {
      const startLine = store.selectionRange.startLine;
      const endLine = store.selectionRange.endLine;
      const prefixRange = new this.monaco.Range(Math.max(1, startLine - 50), 1, startLine - 1, 10000);
      const suffixRange = new this.monaco.Range(endLine + 1, 1, Math.min(totalLines, endLine + 30), 10000);
      prefix = startLine > 1 ? model.getValueInRange(prefixRange) : '';
      suffix = endLine < totalLines ? model.getValueInRange(suffixRange) : '';
    } else {
      const cursorLine = store.cursorLine ?? 1;
      const prefixRange = new this.monaco.Range(Math.max(1, cursorLine - 50), 1, cursorLine, 10000);
      const suffixRange = new this.monaco.Range(cursorLine + 1, 1, Math.min(totalLines, cursorLine + 30), 10000);
      prefix = model.getValueInRange(prefixRange);
      suffix = cursorLine < totalLines ? model.getValueInRange(suffixRange) : '';
    }

    try {
      const response = await window.electronAPI.inlineChat.generate({
        prompt,
        filePath: this.filePath,
        language: this.language,
        scenario: store.scenario!,
        selectedCode: store.selectedCode ?? undefined,
        selectionRange: store.selectionRange ?? undefined,
        cursorLine: store.cursorLine ?? undefined,
        contextFiles,
        surroundingCode: { prefix, suffix },
      });

      if (!this.active) return; // Dismissed while waiting

      if (response.error) {
        store.setError(response.error);
        this.renderWidget(store.scenario!, false, []);
        return;
      }

      if (!response.code.trim()) {
        store.setError('AI \u672a\u8fd4\u56de\u4ee3\u7801');
        this.renderWidget(store.scenario!, false, []);
        return;
      }

      this.generatedCode = response.code;
      store.setGeneratedCode(response.code);

      // Remove the input widget ViewZone
      this.removeWidgetViewZone();

      // Show diff
      this.showDiff();
    } catch (err: any) {
      if (!this.active) return;
      const msg = err?.message || String(err);
      store.setError(msg);
      this.renderWidget(store.scenario!, false, []);
    }
  }

  private showDiff(): void {
    const store = useInlineChatStore.getState();
    if (!this.generatedCode) return;

    if (store.scenario === 'modify' && store.selectionRange && store.selectedCode) {
      // Compute line-level diff
      const diffLines = InlineChatDiffRenderer.computeDiff(store.selectedCode, this.generatedCode);
      this.diffRenderer.showModifyDiff(store.selectionRange.startLine, diffLines);

      // Show action bar after the selection
      const actionLine = store.selectionRange.endLine;
      this.diffRenderer.showActionBar(actionLine, {
        onAccept: () => this.accept(),
        onReject: () => this.reject(),
        onAddToChat: () => this.addToChat(),
      });
    } else {
      // Add scenario - show insert preview
      const afterLine = store.cursorLine ?? 1;
      this.diffRenderer.showInsertPreview(afterLine, this.generatedCode);

      // Show action bar after the preview
      this.diffRenderer.showActionBar(afterLine, {
        onAccept: () => this.accept(),
        onReject: () => this.reject(),
        onAddToChat: () => this.addToChat(),
      });
    }

    // Register keyboard shortcuts for accept/reject/preview
    this.registerKeybindings();
  }

  private registerKeybindings(): void {
    this.unregisterKeybindings();
    const m = this.monaco;
    this.commandDisposables.push(
      this.editor.addAction({
        id: 'inline-chat-accept',
        label: 'Accept Inline Chat Suggestion',
        keybindings: [m.KeyCode.Tab],
        run: () => { this.accept(); },
      })
    );
    this.commandDisposables.push(
      this.editor.addAction({
        id: 'inline-chat-reject',
        label: 'Reject Inline Chat Suggestion',
        keybindings: [m.KeyCode.Escape],
        run: () => { this.reject(); },
      })
    );
    this.commandDisposables.push(
      this.editor.addAction({
        id: 'inline-chat-preview-diff',
        label: 'Preview Full Diff',
        keybindings: [m.KeyMod.Alt],
        run: () => { this.showDiff(); },
      })
    );
  }

  private unregisterKeybindings(): void {
    for (const d of this.commandDisposables) {
      try { d.dispose(); } catch {}
    }
    this.commandDisposables = [];
  }

  /**
   * Accept the generated code - apply it to the editor model.
   */
  async accept(): Promise<void> {
    const store = useInlineChatStore.getState();
    const model = this.editor.getModel();
    if (!model || !this.generatedCode) return;

    if (store.scenario === 'modify' && store.selectionRange) {
      // Replace the selected range with generated code
      const range = new this.monaco.Range(
        store.selectionRange.startLine,
        store.selectionRange.startCol,
        store.selectionRange.endLine,
        store.selectionRange.endCol,
      );
      this.editor.executeEdits('inline-chat', [
        { range, text: this.generatedCode },
      ]);
    } else {
      // Insert at cursor line
      const cursorLine = store.cursorLine ?? 1;
      const lineContent = model.getLineContent(cursorLine);
      // Detect indentation of current line
      const indent = lineContent.match(/^(\s*)/)?.[1] ?? '';
      const indentedCode = this.generatedCode
        .split('\n')
        .map((line) => (line.trim() ? indent + line : line))
        .join('\n');

      const insertPosition = new this.monaco.Range(cursorLine + 1, 1, cursorLine + 1, 1);
      this.editor.executeEdits('inline-chat', [
        { range: insertPosition, text: indentedCode + '\n' },
      ]);
    }

    // Mark file as dirty
    try {
      const { useEditorStore } = await import('../stores/editor-store');
      useEditorStore.getState().markDirty(this.filePath, true);
    } catch {
      // ignore
    }

    this.cleanup();
  }

  /**
   * Reject the generated code - clear all visuals.
   */
  reject(): void {
    this.cleanup();
  }

  /**
   * Dismiss the inline chat (close without action).
   */
  dismiss(): void {
    // Abort any in-flight request
    try {
      window.electronAPI.inlineChat.abort();
    } catch {
      // ignore
    }
    this.cleanup();
  }

  /**
   * Add the context to the main chat panel.
   */
  async addToChat(): Promise<void> {
    const store = useInlineChatStore.getState();

    try {
      const { useChatStore } = await import('../stores/chat-store');
      const { useUIStore } = await import('../stores/ui-store');

      // Set code context in chat
      useChatStore.getState().setCodeContext({
        code: store.selectedCode || this.generatedCode || '',
        filePath: this.filePath,
        language: this.language,
        startLine: store.selectionRange?.startLine,
        endLine: store.selectionRange?.endLine,
      });

      // Pre-fill the chat input with the prompt
      if (this.lastPrompt) {
        useChatStore.getState().setInputText(this.lastPrompt);
      }

      // Open sidebar chat panel
      const uiStore = useUIStore.getState();
      if (!uiStore.showSidebar || uiStore.activeSidebarPanel !== 'chat') {
        uiStore.setSidebarPanel('chat');
        if (!uiStore.showSidebar) uiStore.toggleSidebar();
      }

      // Focus the chat input
      setTimeout(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>('[data-chat-input]');
        textarea?.focus();
      }, 50);
    } catch {
      // ignore
    }

    this.cleanup();
  }

  private removeWidgetViewZone(): void {
    if (this.widgetZoneId !== null) {
      this.editor.changeViewZones((accessor: any) => {
        if (this.widgetZoneId !== null) {
          accessor.removeZone(this.widgetZoneId);
          this.widgetZoneId = null;
        }
      });
    }
    if (this.widgetRoot) {
      this.widgetRoot.unmount();
      this.widgetRoot = null;
    }
    this.widgetDomNode = null;
  }

  private cleanup(): void {
    this.removeWidgetViewZone();
    this.diffRenderer.clear();
    this.unregisterKeybindings();
    this.active = false;
    this.generatedCode = null;
    this.lastPrompt = null;
    useInlineChatStore.getState().reset();
  }

  dispose(): void {
    this.dismiss();
    this.diffRenderer.dispose();
  }
}
