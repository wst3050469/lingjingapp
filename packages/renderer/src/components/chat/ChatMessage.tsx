import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ChatMessage } from '../../stores/chat-store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { TodoList, parseTodoItems } from './TodoList';
import { CodeReviewReportCard } from './CodeReviewReportCard';

// Parse thinking blocks from content. Returns { thinking: string[]; visible: string }
function parseThinkingBlocks(content: string): { thinking: string[]; visible: string } {
  const thinkingBlocks: string[] = [];
  // Match thinking or 思考 blocks
  const thinkingRegex = /(?:<)?(?:thinking|思考)\s*>\s*\n?([\s\S]*?)\s*\n?\s*(?:<)?\/(?:thinking|思考)>/gi;
  let visible = content.replace(thinkingRegex, (_match, captured) => {
    thinkingBlocks.push(captured.trim());
    return '';
  });
  // Clean up extra blank lines
  visible = visible.replace(/\n{3,}/g, '\n\n').trim();
  return { thinking: thinkingBlocks, visible };
}

export function ChatMessageView({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  if (isTool) {
    return <ToolCallView message={message} />;
  }

  // Code Review Report
  if (message.metadata?.type === 'code_review_report') {
    return (
      <div className="my-4">
        <CodeReviewReportCard report={message.metadata.report} />
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-cp-accent text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
          {/* Attachment previews */}
          {message.attachments?.images && message.attachments.images.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {message.attachments.images.map((img, i) => (
                <img key={i} src={img.dataUrl} alt={img.name} className="w-12 h-12 rounded object-cover border border-white/20" />
              ))}
            </div>
          )}
          {message.attachments?.files && message.attachments.files.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {message.attachments.files.map((f, i) => (
                <span key={i} className="text-[10px] bg-white/15 rounded px-1.5 py-0.5 font-mono">@{f.split(/[/\\]/).pop()}</span>
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  const todoItems = useMemo(() => parseTodoItems(message.content), [message.content]);
  const { thinking, visible } = useMemo(() => parseThinkingBlocks(message.content), [message.content]);
  const hasThinking = thinking.length > 0;

  return (
    <div className="text-sm text-cp-text">
      {todoItems && <TodoList items={todoItems} />}

      {/* Thinking block �?collapsible */}
      {hasThinking && (
        <div className="mb-3">
          <button
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
            className="flex items-center gap-1.5 text-[11px] text-purple-400/80 hover:text-purple-300 transition-colors cursor-pointer select-none mb-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${thinkingExpanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>🧠 深度思考过程 ({thinking.length} 步)</span>
          </button>
          {thinkingExpanded && (
            <div className="bg-purple-500/[0.06] border border-purple-500/15 rounded-lg p-3 ml-4">
              {thinking.map((block, i) => (
                <div key={i} className={i > 0 ? 'mt-3 pt-3 border-t border-purple-500/10' : ''}>
                  <div className="text-[11px] text-purple-300/60 font-medium mb-1">
                    思考步骤 {i + 1}
                  </div>
                  <div className="text-[11px] text-purple-200/70 whitespace-pre-wrap leading-relaxed">
                    {block}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Visible content */}
      {visible && (
        <div className="prose prose-invert prose-sm max-w-none
          prose-code:text-cp-success prose-code:bg-black/30 prose-code:px-1 prose-code:rounded
          prose-pre:bg-cp-editor prose-pre:border prose-pre:border-cp-border prose-pre:rounded-lg
          prose-p:leading-relaxed prose-headings:text-cp-text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              pre({ children }) {
                return <>{children}</>;
              },
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const isBlock = match || (typeof children === 'string' && children.includes('\n'));
                if (isBlock) {
                  return (
                    <CodeBlock language={match?.[1] || ''} className={className}>
                      {children}
                    </CodeBlock>
                  );
                }
                return <code className={className} {...props}>{children}</code>;
              },
            }}
          >
            {visible}
          </ReactMarkdown>
        </div>
      )}

      {/* Only thinking content, no visible content */}
      {!visible && hasThinking && (
        <div className="text-[11px] text-cp-text-dim/40 italic ml-4">
          推理完成，正在整理回答...
        </div>
      )}
    </div>
  );
}

function CodeBlock({ language, className, children }: { language: string; className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = extractText(children);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [children]);

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-lang">{language || 'code'}</span>
        <button className="code-copy-btn" onClick={handleCopy}>
          {copied ? '\u2713 Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-cp-editor border border-cp-border rounded-lg overflow-x-auto">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as React.ReactElement).props.children);
  }
  return '';
}

// Tool type label helpers
function getToolCategory(name: string): { label: string; color: string } {
  if (name === 'bash' || name === 'get_terminal_output') return { label: 'Terminal', color: 'text-amber-400' };
  if (name === 'file_read' || name === 'file_write' || name === 'file_edit' || name === 'list_dir') return { label: 'File', color: 'text-blue-400' };
  if (name === 'glob' || name === 'grep' || name === 'codebase_search') return { label: 'Search', color: 'text-cyan-400' };
  if (name.startsWith('mcp__')) return { label: 'MCP', color: 'text-purple-400' };
  if (name === 'web_search' || name === 'web_fetch') return { label: 'Web', color: 'text-green-400' };
  if (name === 'sub_agent') return { label: 'Agent', color: 'text-orange-400' };
  if (name === 'dispatch_experts') return { label: 'Experts', color: 'text-indigo-400' };
  if (name === 'plan') return { label: 'Plan', color: 'text-blue-400' };
  if (name === 'todo') return { label: 'Todo', color: 'text-teal-400' };
  if (name === 'update_memory') return { label: 'Memory', color: 'text-teal-400' };
  if (name === 'get_problems') return { label: 'Problems', color: 'text-red-400' };
  return { label: 'Tool', color: 'text-cp-text-dim' };
}

function RunTimer({ running }: { running: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!running || elapsed < 2) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <span className="text-[10px] text-cp-text-dim/40 tabular-nums">
      {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
    </span>
  );
}

function ToolCallView({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState(() => {
    // Auto-expand bash tool to show live output
    const name = message.toolCalls?.[0]?.name || '';
    return name === 'bash' || name === 'sub_agent';
  });

  if (!message.toolCalls?.length) return null;

  const tc = message.toolCalls[0];
  const hasResult = !!tc.result;
  const isError = tc.result?.isError;
  const isRunning = !hasResult;
  const category = getToolCategory(tc.name);

  // Check if there's live progress output
  const progressText = isRunning && message.content.length > 30
    ? message.content.slice(message.content.indexOf('\n') + 1 || message.content.length)
    : '';

  // Format arguments as compact string for preview
  const argsPreview = Object.entries(tc.args || {})
    .map(([k, v]) => {
      const val = typeof v === 'string' ? (v.length > 60 ? v.slice(0, 60) + '...' : v) : JSON.stringify(v);
      return `${k}: ${val}`;
    })
    .join(', ');

  return (
    <div className="border border-cp-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
      >
        <span className={isError ? 'text-cp-error' : isRunning ? 'text-yellow-400 animate-pulse' : 'text-cp-success'}>
          {isRunning ? '\u25B6' : isError ? '\u2717' : '\u2713'}
        </span>
        {/* Tool category tag */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-white/5 ${category.color}`}>{category.label}</span>
        <span className="font-mono text-purple-400">{String(tc.name)}</span>
        {/* Bash: show command inline */}
        {!!(tc.name === 'bash' && tc.args?.command) && (
          <span className="text-[10px] text-amber-300/60 font-mono truncate max-w-[200px]">
            {String(tc.args.command).slice(0, 60)}
          </span>
        )}
        {/* Non-bash: show args preview */}
        {!!(tc.name !== 'bash' && argsPreview) && (
          <span className="text-cp-text-dim/60 truncate max-w-[300px] text-[10px]">
            ({argsPreview})
          </span>
        )}
        {/* Running badge + timer */}
        {isRunning && (
          <>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
              运行中
            </span>
            <RunTimer running={isRunning} />
          </>
        )}
        <span className="text-cp-text-dim ml-auto flex-shrink-0">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded && (
        <div className="border-t border-cp-border/50">
          {/* Arguments section */}
          {tc.args && Object.keys(tc.args).length > 0 && (
            <div className="px-3 py-2 bg-black/10">
              <div className="text-[10px] text-cp-text-dim/60 uppercase tracking-wider mb-1">Arguments</div>
              <pre className="text-xs text-cp-text-dim overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                {JSON.stringify(tc.args, null, 2)}
              </pre>
            </div>
          )}
          {/* Result section */}
          {tc.result && (
            <div className="px-3 py-2 bg-black/20">
              <div className={`text-[10px] uppercase tracking-wider mb-1 ${isError ? 'text-cp-error/60' : 'text-cp-success/60'}`}>
                {isError ? 'Error' : 'Result'}
              </div>
              {/* Show formatted TodoList for todo tool results */}
              {tc.name === 'todo' && !isError ? (
                <TodoListFromResult content={tc.result.content} />
              ) : (
              <>
              <pre className={`text-xs overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto ${isError ? 'text-red-300' : 'text-cp-text-dim'}`}>
                {tc.result.content.slice(0, 2000)}
                {tc.result.content.length > 2000 ? '\n...(truncated)' : ''}
              </pre>
              {getToolErrorHint(tc.result.content, tc.name) && (
                <div className="mt-2 text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded px-2 py-1.5">
                  {getToolErrorHint(tc.result.content, tc.name)}
                </div>
              )}
              </>
              )}
            </div>
          )}
          {/* Running indicator with live output */}
          {isRunning && (
            <div className="px-3 py-2 bg-black/10">
              {progressText ? (
                <pre className="text-xs text-cp-text-dim/80 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
                  {progressText.slice(-2000)}
                </pre>
              ) : (
                <div className="text-xs text-yellow-400/70 flex items-center gap-2">
                  <span className="animate-spin">&#9696;</span>
                  Running...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/** Detect known kill patterns in tool errors and return an actionable hint */
function getToolErrorHint(content: string, toolName: string): string | null {
  if (toolName !== 'bash') return null;
  if (content.includes('timed out')) return 'Try again with a longer timeout (e.g. 5 min) or split into smaller steps.';
  if (content.includes('Output exceeded')) return 'Output was too large. Try filtering with grep/tail or write to a file.';
  if (content.includes('was aborted')) return 'The process was interrupted. You can retry or skip if not needed.';
  return null;
}

/** Helper: renders parsed TodoList from tool result content */
function TodoListFromResult({ content }: { content: string }) {
  const items = parseTodoItems(content);
  if (!items) {
    return (
      <pre className="text-xs overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto text-cp-text-dim">
        {content.slice(0, 2000)}
        {content.length > 2000 ? '\n...(truncated)' : ''}
      </pre>
    );
  }
  return <TodoList items={items} />;
}
