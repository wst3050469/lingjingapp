// Inline Chat Diff Renderer - Monaco decorations for showing inline chat diffs
// Pattern follows NextDiffWidget.ts

import type * as Monaco from 'monaco-editor';

export interface DiffLine {
  type: 'keep' | 'add' | 'remove';
  text: string;
  /** Original line number (for 'keep' and 'remove') */
  originalLine?: number;
}

interface ActionBarCallbacks {
  onAccept: () => void;
  onReject: () => void;
  onAddToChat: () => void;
}

/**
 * Manages inline chat diff visualization in the Monaco editor.
 * Uses deltaDecorations for removed lines and ViewZones for added lines.
 */
export class InlineChatDiffRenderer {
  private editor: Monaco.editor.IStandaloneCodeEditor;
  private monaco: typeof Monaco;
  private decorationIds: string[] = [];
  private viewZoneIds: string[] = [];
  private actionBarRoot: { unmount: () => void } | null = null;

  constructor(editor: Monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof Monaco) {
    this.editor = editor;
    this.monaco = monacoInstance;
  }

  /**
   * Compute line-level diff between original and generated code.
   * Uses a simple LCS (longest common subsequence) approach.
   */
  static computeDiff(originalText: string, generatedText: string): DiffLine[] {
    const origLines = originalText.split('\n');
    const genLines = generatedText.split('\n');

    // Build LCS table
    const m = origLines.length;
    const n = genLines.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (origLines[i - 1] === genLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to produce diff
    const result: DiffLine[] = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && origLines[i - 1] === genLines[j - 1]) {
        result.push({ type: 'keep', text: origLines[i - 1], originalLine: i });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.push({ type: 'add', text: genLines[j - 1] });
        j--;
      } else {
        result.push({ type: 'remove', text: origLines[i - 1], originalLine: i });
        i--;
      }
    }

    return result.reverse();
  }

  /**
   * Show diff decorations for "modify" scenario.
   * @param startLine - first line of the original selection in the editor
   * @param diffLines - computed diff lines
   */
  showModifyDiff(startLine: number, diffLines: DiffLine[]): void {
    this.clear();

    const decorations: Monaco.editor.IModelDeltaDecoration[] = [];
    const addedBlocks: { afterLine: number; lines: string[] }[] = [];
    let currentAddBlock: { afterLine: number; lines: string[] } | null = null;
    let lastOriginalLine = startLine - 1;

    for (const dl of diffLines) {
      if (dl.type === 'remove') {
        const line = startLine + (dl.originalLine! - 1);
        lastOriginalLine = line;
        decorations.push({
          range: new this.monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'inline-chat-diff-remove',
            overviewRuler: {
              color: '#f8514988',
              position: this.monaco.editor.OverviewRulerLane.Left,
            },
          },
        });
        // Flush any pending add block
        if (currentAddBlock) {
          addedBlocks.push(currentAddBlock);
          currentAddBlock = null;
        }
      } else if (dl.type === 'add') {
        if (!currentAddBlock) {
          currentAddBlock = { afterLine: lastOriginalLine, lines: [] };
        }
        currentAddBlock.lines.push(dl.text);
      } else {
        // keep
        const line = startLine + (dl.originalLine! - 1);
        lastOriginalLine = line;
        // Flush any pending add block
        if (currentAddBlock) {
          addedBlocks.push(currentAddBlock);
          currentAddBlock = null;
        }
      }
    }

    // Flush final add block
    if (currentAddBlock) {
      addedBlocks.push(currentAddBlock);
    }

    // Apply decorations for removed lines
    if (decorations.length > 0) {
      this.decorationIds = this.editor.deltaDecorations([], decorations);
    }

    // Add ViewZones for added lines
    if (addedBlocks.length > 0) {
      const lineHeight = this.editor.getOption(66 /* EditorOption.lineHeight */);
      this.editor.changeViewZones((accessor) => {
        for (const block of addedBlocks) {
          const domNode = document.createElement('div');
          domNode.style.cssText = `
            background: rgba(46, 160, 67, 0.1);
            border-left: 3px solid rgba(46, 160, 67, 0.5);
            padding-left: 12px;
            font-family: Consolas, Monaco, "Courier New", monospace;
            font-size: 14px;
            line-height: ${lineHeight}px;
            color: #3fb950;
          `;

          for (const line of block.lines) {
            const div = document.createElement('div');
            div.textContent = `+ ${line}`;
            domNode.appendChild(div);
          }

          const id = accessor.addZone({
            afterLineNumber: block.afterLine,
            heightInLines: block.lines.length,
            domNode,
          });
          this.viewZoneIds.push(id as unknown as string);
        }
      });
    }
  }

  /**
   * Show insert preview for "add" scenario.
   */
  showInsertPreview(afterLine: number, text: string): void {
    this.clear();

    const lines = text.split('\n');
    const lineHeight = this.editor.getOption(66 /* EditorOption.lineHeight */);

    this.editor.changeViewZones((accessor) => {
      const domNode = document.createElement('div');
      domNode.style.cssText = `
        background: rgba(46, 160, 67, 0.1);
        border-left: 3px solid rgba(46, 160, 67, 0.5);
        padding-left: 12px;
        font-family: Consolas, Monaco, "Courier New", monospace;
        font-size: 14px;
        line-height: ${lineHeight}px;
        color: #3fb950;
      `;

      for (const line of lines) {
        const div = document.createElement('div');
        div.textContent = `+ ${line}`;
        domNode.appendChild(div);
      }

      const id = accessor.addZone({
        afterLineNumber: afterLine,
        heightInLines: lines.length,
        domNode,
      });
      this.viewZoneIds.push(id as unknown as string);
    });
  }

  /**
   * Show the Accept / Reject / Add to Chat action bar as a ViewZone.
   */
  showActionBar(afterLine: number, callbacks: ActionBarCallbacks): void {
    const lineHeight = this.editor.getOption(66 /* EditorOption.lineHeight */);

    this.editor.changeViewZones((accessor) => {
      const domNode = document.createElement('div');
      domNode.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        line-height: ${lineHeight}px;
        background: rgba(30, 30, 30, 0.9);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      `;

      const acceptBtn = document.createElement('button');
      acceptBtn.textContent = '\u2713 \u63a5\u53d7';
      acceptBtn.style.cssText = `
        padding: 2px 10px;
        background: rgba(46, 160, 67, 0.2);
        color: #3fb950;
        border: 1px solid rgba(46, 160, 67, 0.3);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      `;
      acceptBtn.onmouseenter = () => { acceptBtn.style.background = 'rgba(46, 160, 67, 0.35)'; };
      acceptBtn.onmouseleave = () => { acceptBtn.style.background = 'rgba(46, 160, 67, 0.2)'; };
      acceptBtn.onclick = callbacks.onAccept;

      const rejectBtn = document.createElement('button');
      rejectBtn.textContent = '\u2717 \u62d2\u7edd';
      rejectBtn.style.cssText = `
        padding: 2px 10px;
        background: rgba(248, 81, 73, 0.2);
        color: #f85149;
        border: 1px solid rgba(248, 81, 73, 0.3);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      `;
      rejectBtn.onmouseenter = () => { rejectBtn.style.background = 'rgba(248, 81, 73, 0.35)'; };
      rejectBtn.onmouseleave = () => { rejectBtn.style.background = 'rgba(248, 81, 73, 0.2)'; };
      rejectBtn.onclick = callbacks.onReject;

      const chatBtn = document.createElement('button');
      chatBtn.textContent = '\u{1f4ac} \u6dfb\u52a0\u5230\u4f1a\u8bdd';
      chatBtn.style.cssText = `
        padding: 2px 10px;
        background: rgba(56, 132, 255, 0.15);
        color: #58a6ff;
        border: 1px solid rgba(56, 132, 255, 0.3);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      `;
      chatBtn.onmouseenter = () => { chatBtn.style.background = 'rgba(56, 132, 255, 0.3)'; };
      chatBtn.onmouseleave = () => { chatBtn.style.background = 'rgba(56, 132, 255, 0.15)'; };
      chatBtn.onclick = callbacks.onAddToChat;

      domNode.appendChild(acceptBtn);
      domNode.appendChild(rejectBtn);
      domNode.appendChild(chatBtn);

      const id = accessor.addZone({
        afterLineNumber: afterLine,
        heightInLines: 1,
        domNode,
      });
      this.viewZoneIds.push(id as unknown as string);
    });
  }

  /**
   * Clear all decorations and ViewZones.
   */
  clear(): void {
    if (this.decorationIds.length > 0) {
      this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
    }

    if (this.viewZoneIds.length > 0) {
      this.editor.changeViewZones((accessor) => {
        for (const id of this.viewZoneIds) {
          accessor.removeZone(id);
        }
        this.viewZoneIds = [];
      });
    }

    if (this.actionBarRoot) {
      this.actionBarRoot.unmount();
      this.actionBarRoot = null;
    }
  }

  dispose(): void {
    this.clear();
  }
}
