import { useChatStore, type CodeContext } from '../../stores/chat-store';

interface CodeContextPanelProps {
  context: CodeContext;
  onRemove: () => void;
}

export function CodeContextPanel({ context, onRemove }: CodeContextPanelProps) {
  const fileName = context.filePath.split(/[/\\]/).pop() || context.filePath;
  const lineRange = context.startLine
    ? context.endLine && context.endLine !== context.startLine
      ? `L${context.startLine}-${context.endLine}`
      : `L${context.startLine}`
    : '';
  const lineCount = context.code.split('\n').length;
  const preview = context.code.length > 200
    ? context.code.slice(0, 200) + '...'
    : context.code;

  return (
    <div className="mx-2 mt-1.5 border border-cp-border/50 rounded-lg overflow-hidden bg-black/20">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.03]">
        <svg className="w-3 h-3 text-cp-accent/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
        <span className="text-[10px] text-cp-text font-mono truncate flex-1" title={context.filePath}>
          {fileName}
          {lineRange && <span className="text-cp-text-dim/50 ml-1">{lineRange}</span>}
        </span>
        <span className="text-[9px] text-cp-text-dim/40">{lineCount} lines</span>
        <button
          onClick={onRemove}
          className="text-cp-text-dim/40 hover:text-white text-sm leading-none px-0.5 transition-colors"
          title="移除代码上下文"
        >
          x
        </button>
      </div>
      {/* Code preview */}
      <pre className="px-2 py-1.5 text-[10px] text-cp-text-dim/70 font-mono overflow-x-auto max-h-[80px] overflow-y-auto leading-tight whitespace-pre">
        {preview}
      </pre>
    </div>
  );
}
