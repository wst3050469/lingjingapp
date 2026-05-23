// AttachmentPanel - document attachment selection and parsing

import { useState, useCallback } from 'react';
import type { MentionItem } from '../../types/mention';

interface AttachmentPanelProps {
  scope: 'quest' | 'chat';
  selectedContexts: MentionItem[];
  onSelect: (item: MentionItem) => void;
}

const SUPPORTED_FORMATS = [
  { ext: '.md', label: 'Markdown', icon: '\u{1F4DD}' },
  { ext: '.pdf', label: 'PDF', icon: '\u{1F4D5}' },
  { ext: '.docx', label: 'Word', icon: '\u{1F4D8}' },
  { ext: '.xlsx', label: 'Excel', icon: '\u{1F4CA}' },
  { ext: '.xmind', label: 'XMind', icon: '\u{1F9E0}' },
  { ext: '.txt', label: 'Text', icon: '\u{1F4C3}' },
];

export function AttachmentPanel({
  scope,
  selectedContexts,
  onSelect,
}: AttachmentPanelProps) {
  const [isParsing, setIsParsing] = useState(false);

  const handleSelectFile = useCallback(async () => {
    try {
      const filePaths = await window.electronAPI.fs.selectFile();
      if (!filePaths || filePaths.length === 0) return;

      const filePath = filePaths[0];
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      const item: MentionItem = {
        id: `attachment-${filePath}-${Date.now()}`,
        type: 'attachments',
        label: fileName,
        path: filePath,
        icon: 'attachment',
      };

      // Parse document content
      setIsParsing(true);
      try {
        const result = await window.electronAPI.context.parseDocument(filePath);
        item.content = result.content;
      } catch (err) {
        console.error('Failed to parse document:', err);
      } finally {
        setIsParsing(false);
      }

      onSelect(item);
    } catch {
      // User cancelled
    }
  }, [onSelect]);

  return (
    <div className="p-3">
      {/* Select file button */}
      <button
        onClick={handleSelectFile}
        disabled={isParsing}
        className="w-full px-4 py-3 bg-white/5 border border-cp-border/40 rounded-lg
          hover:bg-white/10 hover:border-cp-accent/30 transition-all group disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{isParsing ? '\u23F3' : '\u{1F4CE}'}</span>
          <div className="text-left">
            <div className="text-sm font-medium text-cp-text group-hover:text-cp-accent transition-colors">
              {isParsing ? '\u89E3\u6790\u4E2D...' : '\u9009\u62E9\u9644\u4EF6'}
            </div>
            <div className="text-xs text-cp-text-dim/60 mt-0.5">
              {'\u652F\u6301 md\u3001pdf\u3001docx\u3001xlsx\u3001xmind\u3001txt'}
            </div>
          </div>
        </div>
      </button>

      {/* Drag hint */}
      <div className="mt-3 px-3 py-2 border border-dashed border-cp-border/30 rounded-lg text-center">
        <div className="text-xs text-cp-text-dim/40">
          {'\u6216\u62D6\u62FD\u6587\u4EF6\u5230\u8F93\u5165\u6846'}
        </div>
      </div>

      {/* Supported formats */}
      <div className="mt-3">
        <div className="text-xs text-cp-text-dim/40 mb-2">{'\u652F\u6301\u683C\u5F0F'}</div>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED_FORMATS.map((fmt) => (
            <span
              key={fmt.ext}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]
                bg-white/5 text-cp-text-dim/60 border border-cp-border/20"
            >
              <span>{fmt.icon}</span>
              <span>{fmt.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Already selected attachments preview */}
      {selectedContexts.filter((c) => c.type === 'attachments').length > 0 && (
        <div className="mt-3 border-t border-cp-border/30 pt-2">
          <div className="text-xs text-cp-text-dim/40 mb-1">{'\u5DF2\u9009\u9644\u4EF6'}</div>
          {selectedContexts.filter((c) => c.type === 'attachments').map((ctx) => (
            <div key={ctx.id} className="px-2 py-1 text-xs text-cp-text-dim/80 truncate">
              {'\u{1F4CE}'} {ctx.label}
              {ctx.content && (
                <span className="text-cp-text-dim/40 ml-1">
                  ({ctx.content.length > 200 ? ctx.content.slice(0, 200) + '...' : ctx.content.length} chars)
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
