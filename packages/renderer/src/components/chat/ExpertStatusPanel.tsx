import { useState } from 'react';
import { useExpertsStore, type ExpertTask } from '../../stores/experts-store';
import { getExpertMeta } from '../../utils/expert-meta';
import { ExpertResultCard } from './ExpertResultCard';

export function ExpertStatusPanel() {
  const { phase, tasks, dispatchSummary, openCanvas } = useExpertsStore();
  const [collapsed, setCollapsed] = useState(false);

  if (phase === 'idle') return null;

  const completed = tasks.filter((t) => t && (t.status === 'completed' || t.status === 'failed')).length;
  const total = tasks.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="border border-indigo-500/30 rounded-xl overflow-hidden bg-indigo-500/5">
      {/* Header */}
      <div className="flex items-center">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
        >
          <span className="text-indigo-400 text-sm">
            {phase === 'done' ? '\u2713' : '\u25B6'}
          </span>
          <span className="text-sm font-medium text-cp-text">
            {phase === 'dispatching' ? '\u4e13\u5bb6\u56e2\u6267\u884c\u4e2d' : phase === 'done' ? '\u4e13\u5bb6\u56e2\u5df2\u5b8c\u6210' : '\u4e13\u5bb6\u56e2\u51c6\u5907\u4e2d'}
          </span>
          {total > 0 && (
            <span className="text-xs text-cp-text-dim">
              {completed}/{total}
            </span>
          )}
          {/* Progress bar */}
          {total > 0 && (
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden mx-2">
              <div
                className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
          {dispatchSummary && (
            <span className="text-[10px] text-cp-text-dim">
              {dispatchSummary.succeeded} ok / {dispatchSummary.failed} fail
            </span>
          )}
          <span className="text-cp-text-dim text-xs flex-shrink-0">
            {collapsed ? '\u25BC' : '\u25B2'}
          </span>
        </button>

        {/* Canvas trigger button */}
        {total > 0 && (
          <button
            onClick={() => openCanvas()}
            className="px-3 py-3 text-indigo-400 hover:text-indigo-300 hover:bg-white/[0.05] transition-colors border-l border-indigo-500/20"
            title="\u6253\u5f00\u4e13\u5bb6\u56e2\u5168\u666f\u56fe"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-80">
              <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        )}
      </div>

      {/* Expert emoji avatars row */}
      {!collapsed && tasks.length > 0 && (
        <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
          {tasks.map((task) => {
            const meta = getExpertMeta(task.expertType);
            return (
              <button
                key={task.id}
                onClick={() => openCanvas(task.id)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all hover:scale-110 ${
                  task.status === 'running'
                    ? 'bg-blue-500/15 ring-1 ring-blue-500/40 animate-pulse'
                    : task.status === 'completed'
                      ? 'bg-green-500/10 ring-1 ring-green-500/30'
                      : task.status === 'failed'
                        ? 'bg-red-500/10 ring-1 ring-red-500/30'
                        : 'bg-white/5 ring-1 ring-white/10'
                }`}
                title={`${meta.label}: ${task.title}`}
              >
                {meta.emoji}
              </button>
            );
          })}
        </div>
      )}

      {/* Task cards grid */}
      {!collapsed && tasks.length > 0 && (
        <div className="px-3 pb-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {tasks.map((task) => (
            <ExpertTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpertTaskCard({ task }: { task: ExpertTask }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getExpertMeta(task.expertType);

  const statusBadge = () => {
    switch (task.status) {
      case 'pending':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-cp-text-dim">{'\u7b49\u5f85\u4e2d'}</span>;
      case 'running':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            {'\u8fd0\u884c\u4e2d'}
          </span>
        );
      case 'completed':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{'\u5df2\u5b8c\u6210'}</span>;
      case 'failed':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">{'\u5931\u8d25'}</span>;
    }
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${
        task.status === 'failed'
          ? 'border-red-500/30 bg-red-500/5'
          : task.status === 'running'
            ? 'border-blue-500/30 bg-blue-500/5'
            : task.status === 'completed'
              ? 'border-green-500/20 bg-green-500/5'
              : 'border-cp-border/50 bg-white/[0.02]'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-base flex-shrink-0">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium ${meta.color}`}>{meta.label}</span>
            {statusBadge()}
          </div>
          <p className="text-xs text-cp-text-dim truncate">{task.title}</p>
        </div>
        {(task.result || task.progress) && (
          <span className="text-cp-text-dim/40 text-[10px] flex-shrink-0">
            {expanded ? '\u25B2' : '\u25BC'}
          </span>
        )}
      </button>

      {expanded && (task.result || task.progress) && (
        <div className="border-t border-cp-border/30 px-3 py-2">
          {task.result ? (
            <ExpertResultCard
              expertType={task.expertType}
              title={task.title}
              result={task.result}
              isError={task.isError}
            />
          ) : task.progress ? (
            <pre className="text-[11px] text-cp-text-dim/70 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
              {task.progress.slice(-1500)}
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
}
