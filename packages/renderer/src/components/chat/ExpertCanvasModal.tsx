import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useExpertsStore, type ExpertTask } from '../../stores/experts-store';
import { getExpertMeta } from '../../utils/expert-meta';

export function ExpertCanvasModal() {
  const {
    showCanvas,
    closeCanvas,
    tasks,
    phase,
    dispatchSummary,
    focusedExpertId,
    setFocusedExpert,
    interventions,
  } = useExpertsStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCanvas();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeCanvas]);

  if (!showCanvas) return null;

  const focusedTask = focusedExpertId ? tasks.find((t) => t.id === focusedExpertId) : null;
  const completed = tasks.filter((t) => t.status === 'completed' || t.status === 'failed').length;
  const running = tasks.filter((t) => t.status === 'running').length;

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCanvas();
      }}
    >
      <div className="flex-1 flex m-4 bg-cp-panel border border-cp-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Left sidebar: task overview */}
        <div className="w-72 flex-shrink-0 border-r border-cp-border/50 flex flex-col bg-cp-editor">
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-cp-border/50">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-cp-text">{'\u4e13\u5bb6\u56e2\u5168\u666f\u56fe'}</h2>
              <button
                onClick={closeCanvas}
                className="text-cp-text-dim hover:text-white text-lg transition-colors leading-none"
              >
                &times;
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-cp-text-dim">
              <span>{tasks.length} {'\u4e2a\u4efb\u52a1'}</span>
              {running > 0 && <span className="text-blue-400">{running} {'\u8fd0\u884c\u4e2d'}</span>}
              <span className="text-green-400">{completed} {'\u5df2\u5b8c\u6210'}</span>
            </div>
            {/* Global progress */}
            <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto py-2">
            {tasks.map((task) => {
              const meta = getExpertMeta(task.expertType);
              const isActive = focusedExpertId === task.id;
              return (
                <button
                  key={task.id}
                  onClick={() => setFocusedExpert(isActive ? null : task.id)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors ${
                    isActive
                      ? 'bg-indigo-500/15 border-l-2 border-l-indigo-400'
                      : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium ${meta.color}`}>{meta.label}</span>
                      <TaskStatusDot status={task.status} />
                    </div>
                    <p className="text-xs text-cp-text-dim truncate mt-0.5">{task.title}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dispatch summary */}
          {dispatchSummary && (
            <div className="px-4 py-3 border-t border-cp-border/50 text-[11px] text-cp-text-dim">
              <span className="text-green-400">{dispatchSummary.succeeded}</span> {'\u6210\u529f'} / <span className="text-red-400">{dispatchSummary.failed}</span> {'\u5931\u8d25'} / {dispatchSummary.total} {'\u603b\u8ba1'}
            </div>
          )}

          {/* Intervention history */}
          {interventions.length > 0 && (
            <div className="px-4 py-3 border-t border-cp-border/50">
              <p className="text-[10px] text-cp-text-dim uppercase tracking-wider mb-2">{'\u5e72\u9884\u8bb0\u5f55'}</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {interventions.map((iv) => (
                  <div key={iv.id} className="text-[11px] flex items-start gap-1.5">
                    <span className={iv.injected ? 'text-green-400' : 'text-yellow-400'}>
                      {iv.injected ? '\u2713' : '\u25CF'}
                    </span>
                    <span className="text-cp-text-dim/70 truncate">{iv.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right canvas area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas header */}
          <div className="px-5 py-3 border-b border-cp-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-indigo-400 text-sm">
                {phase === 'done' ? '\u2713' : phase === 'dispatching' ? '\u25B6' : '\u25CB'}
              </span>
              <span className="text-sm text-cp-text font-medium">
                {phase === 'dispatching' ? '\u6267\u884c\u4e2d' : phase === 'done' ? '\u5df2\u5b8c\u6210' : '\u51c6\u5907\u4e2d'}
              </span>
            </div>
            {focusedTask && (
              <button
                onClick={() => setFocusedExpert(null)}
                className="text-xs text-cp-text-dim hover:text-white transition-colors"
              >
                {'\u8fd4\u56de\u603b\u89c8'} &rarr;
              </button>
            )}
          </div>

          {/* Canvas content */}
          <div className="flex-1 overflow-y-auto p-5">
            {focusedTask ? (
              <ExpertDetailView task={focusedTask} />
            ) : (
              <CanvasGrid tasks={tasks} onFocus={setFocusedExpert} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskStatusDot({ status }: { status: ExpertTask['status'] }) {
  const colors: Record<string, string> = {
    pending: 'bg-white/20',
    running: 'bg-blue-400 animate-pulse',
    completed: 'bg-green-400',
    failed: 'bg-red-400',
  };
  return <span className={`w-1.5 h-1.5 rounded-full ${colors[status] ?? 'bg-white/20'}`} />;
}

function CanvasGrid({ tasks, onFocus }: { tasks: ExpertTask[]; onFocus: (id: string) => void }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
      {tasks.map((task) => {
        const meta = getExpertMeta(task.expertType);
        return (
          <button
            key={task.id}
            onClick={() => onFocus(task.id)}
            className={`text-left rounded-xl border p-4 transition-all hover:scale-[1.01] hover:shadow-lg ${
              task.status === 'running'
                ? 'border-blue-500/40 bg-blue-500/5 shadow-blue-500/5'
                : task.status === 'completed'
                  ? 'border-green-500/30 bg-green-500/5'
                  : task.status === 'failed'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-cp-border/50 bg-white/[0.02]'
            }`}
          >
            {/* Card header */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{meta.emoji}</span>
              <div>
                <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                <TaskStatusDot status={task.status} />
              </div>
            </div>

            {/* Task title */}
            <p className="text-sm text-cp-text mb-2 line-clamp-2">{task.title}</p>

            {/* Running: live progress snippet */}
            {task.status === 'running' && task.progress && (
              <div className="mt-2 text-[11px] text-cp-text-dim/60 font-mono line-clamp-3 leading-relaxed">
                {task.progress.slice(-300)}
              </div>
            )}

            {/* Completed: result preview */}
            {task.status === 'completed' && task.result && (
              <div className="mt-2 text-[11px] text-cp-text-dim/60 line-clamp-3 leading-relaxed">
                {task.result.slice(0, 200)}
              </div>
            )}

            {/* Failed: error preview */}
            {task.status === 'failed' && task.result && (
              <div className="mt-2 text-[11px] text-red-400/60 line-clamp-2">
                {task.result.slice(0, 150)}
              </div>
            )}

            {/* Timing */}
            {task.startedAt && (
              <div className="mt-3 text-[10px] text-cp-text-dim/40">
                {task.completedAt
                  ? `${'\u8017\u65f6'} ${((task.completedAt - task.startedAt) / 1000).toFixed(1)}s`
                  : `${'\u5df2\u8fd0\u884c'} ${((Date.now() - task.startedAt) / 1000).toFixed(0)}s`
                }
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ExpertDetailView({ task }: { task: ExpertTask }) {
  const meta = getExpertMeta(task.expertType);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll for running tasks
  useEffect(() => {
    if (task.status === 'running' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [task.progress, task.status]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Expert header */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-4xl">{meta.emoji}</span>
        <div>
          <h3 className={`text-lg font-semibold ${meta.color}`}>{meta.label}</h3>
          <p className="text-sm text-cp-text-dim">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <TaskStatusBadge status={task.status} />
            {task.startedAt && (
              <span className="text-[10px] text-cp-text-dim/50">
                {task.completedAt
                  ? `${'\u8017\u65f6'} ${((task.completedAt - task.startedAt) / 1000).toFixed(1)}s`
                  : `${'\u5df2\u8fd0\u884c'} ${((Date.now() - task.startedAt) / 1000).toFixed(0)}s`
                }
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Result / Progress content */}
      <div ref={scrollRef} className="rounded-xl border border-cp-border/50 bg-cp-editor overflow-y-auto max-h-[calc(100vh-280px)]">
        {task.result ? (
          <div className={`p-5 prose prose-invert prose-sm max-w-none
            prose-code:text-cp-success prose-code:bg-black/30 prose-code:px-1 prose-code:rounded
            prose-pre:bg-cp-editor prose-pre:border prose-pre:border-cp-border prose-pre:rounded
            ${task.isError ? 'text-red-300' : ''}`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.result}</ReactMarkdown>
          </div>
        ) : task.progress ? (
          <pre className="p-5 text-xs text-cp-text-dim/70 whitespace-pre-wrap font-mono leading-relaxed">
            {task.progress}
          </pre>
        ) : (
          <div className="p-5 text-sm text-cp-text-dim/40 text-center">
            {task.status === 'pending' ? '\u7b49\u5f85\u5206\u914d...' : '\u6682\u65e0\u5185\u5bb9'}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskStatusBadge({ status }: { status: ExpertTask['status'] }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-white/5', text: 'text-cp-text-dim', label: '\u7b49\u5f85\u4e2d' },
    running: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: '\u8fd0\u884c\u4e2d' },
    completed: { bg: 'bg-green-500/10', text: 'text-green-400', label: '\u5df2\u5b8c\u6210' },
    failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: '\u5931\u8d25' },
  };
  const c = config[status] ?? config.pending;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
