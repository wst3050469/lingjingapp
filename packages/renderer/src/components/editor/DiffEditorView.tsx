// DiffEditorView - Monaco DiffEditor wrapper for reviewing agent file changes
// Shows inline diff with per-hunk Accept/Reject controls

import { useRef, useEffect, useCallback } from 'react';
import { DiffEditor, type Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditor_NS } from 'monaco-editor';
import { useDiffReviewStore } from '../../stores/diff-review-store';

// Detect language from file extension
function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', css: 'css', scss: 'scss', less: 'less',
    html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
    md: 'markdown', py: 'python', rs: 'rust', go: 'go',
    java: 'java', cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
    sh: 'shell', bash: 'shell', yml: 'yaml', yaml: 'yaml',
    sql: 'sql', vue: 'html', svelte: 'html',
  };
  return map[ext] || 'plaintext';
}

export function DiffEditorView() {
  const { activeReviewFile, fileChanges, acceptHunk, rejectHunk, acceptFile, rejectFile } =
    useDiffReviewStore();
  const editorRef = useRef<MonacoEditor_NS.IStandaloneDiffEditor | null>(null);
  const viewZoneIds = useRef<string[]>([]);

  const fc = activeReviewFile ? fileChanges[activeReviewFile] : null;

  const clearViewZones = useCallback(() => {
    if (editorRef.current && viewZoneIds.current.length > 0) {
      const modifiedEditor = editorRef.current.getModifiedEditor();
      modifiedEditor.changeViewZones((accessor: any) => {
        for (const id of viewZoneIds.current) {
          accessor.removeZone(id);
        }
      });
      viewZoneIds.current = [];
    }
  }, []);

  const addHunkControls = useCallback(() => {
    if (!editorRef.current || !fc) return;
    clearViewZones();

    const modifiedEditor = editorRef.current.getModifiedEditor();
    const lineChanges = editorRef.current.getLineChanges();
    if (!lineChanges || lineChanges.length === 0) return;

    modifiedEditor.changeViewZones((accessor: any) => {
      // Map line changes to hunks by position
      for (let i = 0; i < fc.hunks.length && i < lineChanges.length; i++) {
        const hunk = fc.hunks[i];
        const change = lineChanges[i];

        // Determine the line after which to place the action bar
        const afterLine = change.modifiedEndLineNumber || change.modifiedStartLineNumber;

        const domNode = document.createElement('div');
        domNode.style.cssText = `
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 2px 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 11px;
          background: rgba(30, 30, 30, 0.95);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        `;

        // Status indicator
        if (hunk.decision !== 'pending') {
          const indicator = document.createElement('span');
          indicator.style.cssText = `font-size: 10px; margin-right: 2px;`;
          indicator.textContent = hunk.decision === 'accepted' ? '\u2705' : '\u274c';
          domNode.appendChild(indicator);
        }

        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = hunk.decision === 'accepted' ? '\u2713 \u5df2\u63a5\u53d7' : '\u2713 \u63a5\u53d7';
        acceptBtn.style.cssText = `
          padding: 1px 8px;
          background: ${hunk.decision === 'accepted' ? 'rgba(46, 160, 67, 0.35)' : 'rgba(46, 160, 67, 0.15)'};
          color: #3fb950;
          border: 1px solid rgba(46, 160, 67, 0.3);
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        acceptBtn.onmouseenter = () => { acceptBtn.style.background = 'rgba(46, 160, 67, 0.4)'; };
        acceptBtn.onmouseleave = () => { acceptBtn.style.background = hunk.decision === 'accepted' ? 'rgba(46, 160, 67, 0.35)' : 'rgba(46, 160, 67, 0.15)'; };
        acceptBtn.onclick = () => {
          if (activeReviewFile) acceptHunk(activeReviewFile, hunk.id);
        };

        const rejectBtn = document.createElement('button');
        rejectBtn.textContent = hunk.decision === 'rejected' ? '\u2717 \u5df2\u62d2\u7edd' : '\u2717 \u62d2\u7edd';
        rejectBtn.style.cssText = `
          padding: 1px 8px;
          background: ${hunk.decision === 'rejected' ? 'rgba(248, 81, 73, 0.35)' : 'rgba(248, 81, 73, 0.15)'};
          color: #f85149;
          border: 1px solid rgba(248, 81, 73, 0.3);
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        rejectBtn.onmouseenter = () => { rejectBtn.style.background = 'rgba(248, 81, 73, 0.4)'; };
        rejectBtn.onmouseleave = () => { rejectBtn.style.background = hunk.decision === 'rejected' ? 'rgba(248, 81, 73, 0.35)' : 'rgba(248, 81, 73, 0.15)'; };
        rejectBtn.onclick = () => {
          if (activeReviewFile) rejectHunk(activeReviewFile, hunk.id);
        };

        domNode.appendChild(acceptBtn);
        domNode.appendChild(rejectBtn);

        const id = accessor.addZone({
          afterLineNumber: afterLine,
          heightInLines: 1,
          domNode,
        });
        viewZoneIds.current.push(id as unknown as string);
      }
    });
  }, [fc, activeReviewFile, acceptHunk, rejectHunk, clearViewZones]);

  // Re-add hunk controls when decisions change
  useEffect(() => {
    if (editorRef.current && fc) {
      // Small delay to let DiffEditor compute line changes
      const timer = setTimeout(addHunkControls, 100);
      return () => clearTimeout(timer);
    }
  }, [fc?.hunks, addHunkControls]);

  const handleDiffEditorMount = (editor: MonacoEditor_NS.IStandaloneDiffEditor, _monaco: Monaco) => {
    editorRef.current = editor;
    // Wait for diff computation to complete, then add hunk controls
    setTimeout(addHunkControls, 300);
  };

  if (!fc || !activeReviewFile) {
    return (
      <div className="h-full flex items-center justify-center text-cp-text-dim text-xs">
        Select a file from the review bar to view changes
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Diff Editor */}
      <div className="flex-1 overflow-hidden">
        <DiffEditor
          key={activeReviewFile}
          height="100%"
          language={detectLanguage(activeReviewFile)}
          original={fc.beforeContent ?? ''}
          modified={fc.afterContent}
          theme="vs-dark"
          onMount={handleDiffEditorMount}
          options={{
            readOnly: true,
            renderSideBySide: false,
            fontSize: 14,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            folding: true,
            glyphMargin: true,
            renderOverviewRuler: true,
          }}
        />
      </div>

      {/* File-level footer bar */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-cp-tab-inactive border-t border-cp-border">
        <span className="text-[10px] text-cp-text-dim">
          {fc.fileName}
          {fc.isNewFile && <span className="ml-1.5 text-green-400">(new)</span>}
          {fc.status !== 'pending' && (
            <span className={`ml-1.5 ${fc.status === 'accepted' ? 'text-green-400' : fc.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`}>
              ({fc.status === 'accepted' ? '\u5df2\u63a5\u53d7' : fc.status === 'rejected' ? '\u5df2\u62d2\u7edd' : '\u90e8\u5206\u5904\u7406'})
            </span>
          )}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => acceptFile(activeReviewFile)}
            className="px-2.5 py-0.5 bg-green-600/20 text-green-400 rounded text-[10px] hover:bg-green-600/30 transition-colors border border-green-600/30"
          >
            {'\u2713'} \u63a5\u53d7\u6240\u6709\u53d8\u66f4
          </button>
          <button
            onClick={() => rejectFile(activeReviewFile)}
            className="px-2.5 py-0.5 bg-red-600/20 text-red-400 rounded text-[10px] hover:bg-red-600/30 transition-colors border border-red-600/30"
          >
            {'\u2717'} \u62d2\u7edd\u6240\u6709\u53d8\u66f4
          </button>
        </div>
      </div>
    </div>
  );
}
