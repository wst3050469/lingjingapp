import { useState } from 'react';
import type { NetworkDiagItem } from '../../../ipc/ipc-client';

/* --- Helper components --- */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.03] border border-cp-border/40 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

type DiagStatus = 'idle' | 'running' | 'done';

/* --- Status icon --- */

function StatusIcon({ status, ok }: { status: DiagStatus; ok?: boolean }) {
  if (status === 'idle') {
    return (
      <span className="w-5 h-5 rounded-full border border-cp-border/40 flex items-center justify-center">
        <span className="w-1.5 h-1.5 rounded-full bg-cp-text-dim/30" />
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="w-5 h-5 rounded-full border-2 border-cp-accent border-t-transparent animate-spin" />
    );
  }
  // done
  if (ok) {
    return (
      <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
        <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
      <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

/* --- Main Component --- */

const DIAG_ITEMS = ['DNS', 'HTTP', 'Ping', 'Marketplace'] as const;

export function NetworkTab() {
  const [status, setStatus] = useState<DiagStatus>('idle');
  const [results, setResults] = useState<NetworkDiagItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const handleDiagnose = async () => {
    setStatus('running');
    setResults([]);
    setLogs([]);
    setShowLogs(false);
    try {
      const res = await window.electronAPI.network.diagnose();
      setResults(res.results);
      setLogs(res.logs);
      setStatus('done');
    } catch (err: any) {
      setLogs([`Error: ${err.message || 'Unknown error'}`]);
      setStatus('done');
    }
  };

  const getItemResult = (name: string): NetworkDiagItem | undefined => {
    return results.find((r) => r.name === name);
  };

  const getItemStatus = (name: string): DiagStatus => {
    if (status === 'idle') return 'idle';
    if (status === 'running') {
      // If we have a result for this item, it's done; otherwise still running
      return getItemResult(name) ? 'done' : 'running';
    }
    return 'done';
  };

  const allOk = status === 'done' && results.length > 0 && results.every((r) => r.ok);
  const hasFailure = status === 'done' && results.some((r) => !r.ok);

  return (
    <div className="space-y-6">
      {/* --- Main diagnostic card --- */}
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-[13px] text-cp-text-dim/70">
            诊断网络连接问题并检查各种网络服务的状态。
          </p>
          <button
            onClick={handleDiagnose}
            disabled={status === 'running'}
            className="shrink-0 ml-4 text-xs px-4 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:bg-white/10 hover:text-cp-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'running' ? '诊断中...' : '开始诊断'}
          </button>
        </div>

        {/* Diagnostic items */}
        <div className="space-y-0">
          {DIAG_ITEMS.map((name, i) => {
            const itemStatus = getItemStatus(name);
            const result = getItemResult(name);
            return (
              <div key={name}>
                <div className="flex items-center gap-3 py-4">
                  <StatusIcon status={itemStatus} ok={result?.ok} />
                  <span className="text-sm text-cp-text font-medium">{name}</span>
                  {result && itemStatus === 'done' && (
                    <span className={`text-[11px] ml-auto ${result.ok ? 'text-cp-text-dim/40' : 'text-red-400/70'}`}>
                      {result.ok ? `${result.latency}ms` : result.detail}
                    </span>
                  )}
                </div>
                {i < DIAG_ITEMS.length - 1 && (
                  <div className="border-t border-cp-border/10" />
                )}
              </div>
            );
          })}
        </div>

        {/* Summary / divider */}
        {status === 'done' && (
          <>
            <div className="border-t border-cp-border/20 mt-2 pt-3">
              {allOk && (
                <p className="text-[12px] text-green-400/80">所有网络服务正常运行。</p>
              )}
              {hasFailure && (
                <p className="text-[12px] text-red-400/80">部分网络服务异常，请查看日志获取详细信息。</p>
              )}
            </div>
          </>
        )}

        {/* Show logs button */}
        <div className="border-t border-cp-border/15 mt-4 pt-3 flex justify-end">
          <button
            onClick={() => setShowLogs(!showLogs)}
            disabled={logs.length === 0}
            className="text-xs px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:bg-white/10 hover:text-cp-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {showLogs ? '隐藏日志' : '显示日志'}
          </button>
        </div>

        {/* Logs panel */}
        {showLogs && logs.length > 0 && (
          <div className="mt-3 bg-black/30 border border-cp-border/20 rounded-lg p-3 max-h-[300px] overflow-y-auto">
            <pre className="text-[11px] text-cp-text-dim/70 font-mono leading-relaxed whitespace-pre-wrap">
              {logs.join('\n')}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}
