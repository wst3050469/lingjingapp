// ContextChips - displays selected context items as chips
// Moved from chat/ to context/ for shared use

import type { AttachedImage } from '../../hooks/useImageAttachments';
import type { MentionItem } from '../../types/mention';

interface ContextChipsProps {
  images?: AttachedImage[];
  files?: string[];
  contexts?: MentionItem[];
  onRemoveImage?: (index: number) => void;
  onRemoveFile?: (path: string) => void;
  onRemoveContext?: (id: string) => void;
}

export function ContextChips({
  images = [],
  files = [],
  contexts = [],
  onRemoveImage,
  onRemoveFile,
  onRemoveContext,
}: ContextChipsProps) {
  if (images.length === 0 && files.length === 0 && contexts.length === 0) return null;

  const getContextIcon = (context: MentionItem): string => {
    switch (context.type) {
      case 'folder':
        return '\u{1F4C1}';
      case 'attachments':
        return '\u{1F4CE}';
      case 'rule':
        return '\u{1F4CB}';
      default:
        return '\u{1F4C4}';
    }
  };

  const getContextStyle = (context: MentionItem): string => {
    switch (context.type) {
      case 'attachments':
        return 'bg-purple-500/10 border-purple-500/20 text-purple-300';
      case 'rule':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-300';
      case 'folder':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-300';
      default:
        return 'bg-white/[0.06] border-cp-border/40 text-cp-text-dim';
    }
  };

  return (
    <div className="flex gap-1.5 px-3 pb-1.5 pt-2 flex-wrap">
      {images.map((img, i) => (
        <span key={`img-${i}`} className="inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-md bg-white/[0.06] border border-cp-border/40 text-[10px] text-cp-text-dim group">
          <img src={img.dataUrl} alt={img.name} className="w-4 h-4 object-cover rounded" />
          <span className="truncate max-w-[60px]">{img.name}</span>
          {onRemoveImage && (
            <button
              onClick={() => onRemoveImage(i)}
              className="text-cp-text-dim/40 hover:text-cp-text ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              &times;
            </button>
          )}
        </span>
      ))}
      {files.map((f) => (
        <span key={f} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cp-accent/10 border border-cp-accent/20 text-[10px] text-cp-accent group">
          @{f.split(/[/\\]/).pop()}
          {onRemoveFile && (
            <button
              onClick={() => onRemoveFile(f)}
              className="text-cp-accent/50 hover:text-cp-accent ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              &times;
            </button>
          )}
        </span>
      ))}
      {contexts.map((ctx) => (
        <span
          key={ctx.id}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border group ${getContextStyle(ctx)}`}
        >
          <span className="text-xs">{getContextIcon(ctx)}</span>
          <span className="truncate max-w-[100px]">@{ctx.label}</span>
          {ctx.type === 'attachments' && ctx.content && (
            <span className="text-[9px] opacity-60">
              ({ctx.content.length > 1000 ? `${(ctx.content.length / 1000).toFixed(0)}k` : ctx.content.length})
            </span>
          )}
          {onRemoveContext && (
            <button
              onClick={() => onRemoveContext(ctx.id)}
              className="opacity-40 hover:opacity-100 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              &times;
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
