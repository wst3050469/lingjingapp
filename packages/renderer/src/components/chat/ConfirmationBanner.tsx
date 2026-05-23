import { useState, useEffect, useCallback } from 'react';
import { useConfirmationStore, type ConfirmationRequest } from '../../stores/confirmation-store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ConfirmationBanner() {
  const { request: pendingRequest, reply } = useConfirmationStore();

  if (!pendingRequest) return null;

  return (
    <div className="border-t border-cp-border bg-cp-bg">
      {pendingRequest.type === 'bash' && (
        <BashConfirmation request={pendingRequest} onReply={reply} />
      )}
      {pendingRequest.type === 'mcp' && (
        <McpConfirmation request={pendingRequest} onReply={reply} />
      )}
      {pendingRequest.type === 'plan' && (
        <PlanConfirmation request={pendingRequest} onReply={reply} />
      )}
    </div>
  );
}

function BashConfirmation({
  request,
  onReply,
}: {
  request: ConfirmationRequest;
  onReply: (requestId: string, approved: boolean, feedback?: string) => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onReply(request.requestId, true);
      } else if (e.key === 'Escape') {
        onReply(request.requestId, false);
      }
    },
    [request.requestId, onReply]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="p-3">
      <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
            命令执行确认
          </span>
        </div>
        <div className="bg-black/40 rounded-lg px-3 py-2 mb-3 font-mono text-sm text-cp-text overflow-x-auto">
          {request.command || String(request.args?.command || '')}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onReply(request.requestId, true)}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            执行
          </button>
          <button
            onClick={() => onReply(request.requestId, false)}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-cp-text text-xs font-medium rounded-lg transition-colors"
          >
            取消
          </button>
          <span className="text-[10px] text-cp-text-dim/40 ml-auto">Enter 执行 / Esc 取消</span>
        </div>
      </div>
    </div>
  );
}

function McpConfirmation({
  request,
  onReply,
}: {
  request: ConfirmationRequest;
  onReply: (requestId: string, approved: boolean, feedback?: string) => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onReply(request.requestId, true);
      } else if (e.key === 'Escape') {
        onReply(request.requestId, false);
      }
    },
    [request.requestId, onReply]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const argsPreview = Object.entries(request.args || {})
    .map(([k, v]) => {
      const val = typeof v === 'string' ? (v.length > 80 ? v.slice(0, 80) + '...' : v) : JSON.stringify(v);
      return `${k}: ${val}`;
    })
    .join('\n');

  return (
    <div className="p-3">
      <div className="bg-purple-500/5 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
            MCP 工具确认
          </span>
        </div>
        <div className="mb-2">
          <span className="font-mono text-sm text-purple-300">{request.toolName}</span>
        </div>
        {argsPreview && (
          <pre className="bg-black/40 rounded-lg px-3 py-2 mb-3 text-xs text-cp-text-dim overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
            {argsPreview}
          </pre>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onReply(request.requestId, true)}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            允许
          </button>
          <button
            onClick={() => onReply(request.requestId, false)}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-cp-text text-xs font-medium rounded-lg transition-colors"
          >
            拒绝
          </button>
          <span className="text-[10px] text-cp-text-dim/40 ml-auto">Enter 允许 / Esc 拒绝</span>
        </div>
      </div>
    </div>
  );
}

function PlanConfirmation({
  request,
  onReply,
}: {
  request: ConfirmationRequest;
  onReply: (requestId: string, approved: boolean, feedback?: string) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleApprove = () => onReply(request.requestId, true);
  const handleReject = () => {
    if (showFeedback && feedback.trim()) {
      onReply(request.requestId, false, feedback.trim());
    } else {
      setShowFeedback(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFeedback) {
          setShowFeedback(false);
        } else {
          onReply(request.requestId, false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [request.requestId, onReply, showFeedback]);

  return (
    <div className="p-3">
      <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">
            执行计划审阅
          </span>
          {request.planTitle && (
            <span className="text-sm text-cp-text font-medium ml-1">{request.planTitle}</span>
          )}
        </div>
        <div className="bg-black/40 rounded-lg px-4 py-3 mb-3 max-h-64 overflow-y-auto prose prose-invert prose-sm max-w-none
          prose-code:text-cp-success prose-code:bg-black/30 prose-code:px-1 prose-code:rounded
          prose-p:leading-relaxed prose-headings:text-cp-text prose-li:text-cp-text-dim">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {request.planContent || ''}
          </ReactMarkdown>
        </div>
        {showFeedback && (
          <div className="mb-3">
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && feedback.trim()) {
                  onReply(request.requestId, false, feedback.trim());
                }
              }}
              placeholder="请输入修改建议..."
              className="w-full bg-black/30 border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-blue-400/50"
              autoFocus
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleApprove}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            批准执行
          </button>
          <button
            onClick={handleReject}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-cp-text text-xs font-medium rounded-lg transition-colors"
          >
            {showFeedback ? '发送修改建议' : '需要修改'}
          </button>
          <span className="text-[10px] text-cp-text-dim/40 ml-auto">Esc 取消</span>
        </div>
      </div>
    </div>
  );
}
