// NEXT Diff Widget - Monaco decorations for showing diffs (add/remove/modify)

import type * as Monaco from 'monaco-editor';

export interface DiffEntry {
  type: 'add' | 'remove' | 'modify';
  startLine: number;
  endLine: number;
  newText?: string;
}

/**
 * Manages diff decorations in the Monaco editor.
 * Used for showing preview of multi-edit suggestions and cross-file changes.
 */
export class NextDiffWidget {
  private editor: Monaco.editor.IStandaloneCodeEditor;
  private monaco: typeof Monaco;
  private decorationIds: string[] = [];
  private viewZoneIds: string[] = [];

  constructor(editor: Monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof Monaco) {
    this.editor = editor;
    this.monaco = monacoInstance;
  }

  /**
   * Show diff decorations for a set of changes
   */
  showDiff(entries: DiffEntry[]): void {
    this.clear();

    const decorations: Monaco.editor.IModelDeltaDecoration[] = [];

    for (const entry of entries) {
      switch (entry.type) {
        case 'add':
          decorations.push({
            range: new this.monaco.Range(entry.startLine, 1, entry.endLine, 1),
            options: {
              isWholeLine: true,
              className: 'next-diff-add',
              glyphMarginClassName: 'next-diff-add-glyph',
              overviewRuler: {
                color: '#2ea04388',
                position: this.monaco.editor.OverviewRulerLane.Left,
              },
            },
          });
          break;

        case 'remove':
          decorations.push({
            range: new this.monaco.Range(entry.startLine, 1, entry.endLine, 1),
            options: {
              isWholeLine: true,
              className: 'next-diff-remove',
              glyphMarginClassName: 'next-diff-remove-glyph',
              overviewRuler: {
                color: '#f8514988',
                position: this.monaco.editor.OverviewRulerLane.Left,
              },
            },
          });
          break;

        case 'modify':
          decorations.push({
            range: new this.monaco.Range(entry.startLine, 1, entry.endLine, 1),
            options: {
              isWholeLine: true,
              className: 'next-diff-modify',
              overviewRuler: {
                color: '#d29922aa',
                position: this.monaco.editor.OverviewRulerLane.Left,
              },
            },
          });
          break;
      }
    }

    this.decorationIds = this.editor.deltaDecorations([], decorations);
  }

  /**
   * Show new text preview using ViewZones (for added lines)
   */
  showAddedLines(afterLine: number, text: string): void {
    const lines = text.split('\n');
    const lineHeight = this.editor.getOption(66 /* EditorOption.lineHeight */);

    this.editor.changeViewZones((accessor: any) => {
      const domNode = document.createElement('div');
      domNode.className = 'next-diff-added-zone';
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
   * Clear all diff decorations and view zones
   */
  clear(): void {
    if (this.decorationIds.length > 0) {
      this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
    }

    if (this.viewZoneIds.length > 0) {
      this.editor.changeViewZones((accessor: any) => {
        for (const id of this.viewZoneIds) {
          accessor.removeZone(id);
        }
        this.viewZoneIds = [];
      });
    }
  }

  dispose(): void {
    this.clear();
  }
}
