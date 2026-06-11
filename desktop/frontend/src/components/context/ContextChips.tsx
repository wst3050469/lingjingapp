import type { FileAttachment } from '../../hooks/useFileAttachments';
import type { MentionItem } from '../../types/mention';

function getDocIcon(ext?: string): string {
  switch (ext) {
    case '.pdf':  return '\u{1F4D5}';
    case '.doc': case '.docx': return '\u{1F4D8}';
    case '.xls': case '.xlsx': return '\u{1F4CA}';
    case '.md':   return '\u{1F4DD}';
    case '.txt':  return '\u{1F4C3}';
    default:      return '\u{1F4C4}';
  }
}

interface ContextChipsProps {
  attachments?: FileAttachment[];
  contexts?: MentionItem[];
  onRemoveAttachment?: (id: string) => void;
  onRemoveContext?: (id: string) => void;
}

export function ContextChips({
  attachments = [],
  contexts = [],
  onRemoveAttachment,
  onRemoveContext,
}: ContextChipsProps) {
  if (attachments.length === 0 && contexts.length === 0) return null;

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
      {attachments.map((att) => (
        <span
          key={att.id}
          className={`inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-md text-[10px] border group ${
            att.type === 'image'
              ? 'bg-white/[0.06] border-cp-border/40 text-cp-text-dim'
              : 'bg-purple-500/10 border-purple-500/20 text-purple-300'
          }`}
        >
          {att.type === 'image' && att.dataUrl ? (
            <img src={att.dataUrl} alt={att.name} className="w-4 h-4 object-cover rounded" />
          ) : (
            <span className="text-xs">{getDocIcon(att.ext)}</span>
          )}

          <span className="truncate max-w-[80px]">{att.name}</span>

          {att.type === 'document' && att.parseStatus === 'parsing' && (
            <span className="text-[9px] text-purple-400/60 animate-pulse">解析中</span>
          )}
          {att.type === 'document' && att.parseStatus === 'failed' && (
            <span className="text-[9px] text-red-400/80">失败</span>
          )}
          {att.type === 'document' && att.parseStatus === 'success' && att.content && (
            <span className="text-[9px] opacity-60">
              {att.content.length > 1000 ? `${(att.content.length / 1000).toFixed(0)}k` : `${att.content.length}`}
            </span>
          )}

          {onRemoveAttachment && (
            <button
              onClick={() => onRemoveAttachment(att.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
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
