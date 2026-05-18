// NEXT Display Manager - determines Side by Side vs Inline display mode

import type * as Monaco from 'monaco-editor';

export type DisplayMode = 'inline' | 'sideBySide';

/**
 * Determines whether to show completion as inline ghost text
 * or as a side-by-side diff panel based on available width.
 */
export function determineDisplayMode(
  editor: Monaco.editor.IStandaloneCodeEditor,
  completionText: string,
  currentLineText: string
): DisplayMode {
  try {
    const layoutInfo = editor.getLayoutInfo();
    const editorWidth = layoutInfo.contentWidth;

    // Get font metrics
    const fontInfo = editor.getOption(48 /* EditorOption.fontInfo */);
    const charWidth = (fontInfo as any).typicalHalfwidthCharacterWidth || 7.5;

    // Calculate combined width of current line + first line of completion
    const firstCompletionLine = completionText.split('\n')[0];
    const combinedLength = currentLineText.length + firstCompletionLine.length;
    const combinedWidth = combinedLength * charWidth;

    // If multi-line completion or too wide, prefer Side by Side
    const isMultiLine = completionText.includes('\n');
    if (isMultiLine && combinedWidth > editorWidth * 0.7) {
      return 'sideBySide';
    }

    return combinedWidth > editorWidth ? 'sideBySide' : 'inline';
  } catch {
    return 'inline';
  }
}

/**
 * Manages the visual representation of completions.
 * For inline mode, Monaco handles it natively.
 * For side-by-side mode, we use ViewZones and decorations.
 */
export class NextDisplayManager {
  private editor: Monaco.editor.IStandaloneCodeEditor;
  private monaco: typeof Monaco;
  private currentViewZoneId: string | null = null;
  private currentDecorations: string[] = [];

  constructor(editor: Monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof Monaco) {
    this.editor = editor;
    this.monaco = monacoInstance;
  }

  /**
   * Show a side-by-side completion preview using ViewZones
   */
  showSideBySide(
    position: Monaco.IPosition,
    completionText: string
  ): void {
    this.clear();

    const lines = completionText.split('\n');
    const lineHeight = this.editor.getOption(66 /* EditorOption.lineHeight */);

    // Create a ViewZone below the current line
    this.editor.changeViewZones((accessor: any) => {
      const domNode = document.createElement('div');
      domNode.className = 'next-sidebyside-zone';
      domNode.style.cssText = `
        opacity: 0.6;
        font-style: italic;
        color: #808080;
        padding-left: 12px;
        font-family: Consolas, Monaco, "Courier New", monospace;
        font-size: 14px;
        line-height: ${lineHeight}px;
        background: rgba(79, 193, 255, 0.04);
        border-left: 2px solid rgba(79, 193, 255, 0.3);
      `;

      for (const line of lines) {
        const lineDiv = document.createElement('div');
        lineDiv.textContent = line || ' ';
        domNode.appendChild(lineDiv);
      }

      this.currentViewZoneId = accessor.addZone({
        afterLineNumber: position.lineNumber,
        heightInLines: lines.length,
        domNode,
      }) as unknown as string;
    });

    // Add decoration on the current line to indicate suggestion
    this.currentDecorations = this.editor.deltaDecorations([], [
      {
        range: new this.monaco.Range(
          position.lineNumber,
          1,
          position.lineNumber,
          1
        ),
        options: {
          isWholeLine: true,
          className: 'next-suggestion-line',
          overviewRuler: {
            color: '#4fc1ff44',
            position: this.monaco.editor.OverviewRulerLane.Right,
          },
        },
      },
    ]);
  }

  /**
   * Clear any side-by-side display
   */
  clear(): void {
    if (this.currentViewZoneId !== null) {
      this.editor.changeViewZones((accessor: any) => {
        if (this.currentViewZoneId !== null) {
          accessor.removeZone(this.currentViewZoneId);
          this.currentViewZoneId = null;
        }
      });
    }

    if (this.currentDecorations.length > 0) {
      this.currentDecorations = this.editor.deltaDecorations(this.currentDecorations, []);
    }
  }

  dispose(): void {
    this.clear();
  }
}
