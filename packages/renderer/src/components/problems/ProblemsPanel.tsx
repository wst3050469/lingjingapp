import { useState, useEffect, useCallback } from 'react';

interface DiagnosticItem {
  file: string;
  line: number;
  col: number;
  severity: string;
  code: string;
  source: string;
  message: string;
}

function parseDiagnostics(raw: string): DiagnosticItem[] {
  if (!raw || raw.trim() === '' || raw.startsWith('No diagnostics') || raw.startsWith('No workspace')) {
    return [];
  }

  const items: DiagnosticItem[] = [];
  const lines = raw.split('\n').filter(l => l.trim());

  for (const line of lines) {
    // Format: file.ts:12:5 error TS2322: source: message
    const match = line.match(/^(.+?):(\d+):(\d+)\s+(error|warning|info|hint)\s*([\w\d]*)?:\s*(?:(.+?):\s*)?(.+)$/);
    if (match) {
      items.push({
        file: match[1],
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
        severity: match[4],
        code: match[5] ?? '',
        source: match[6] ?? '',
        message: match[7],
      });
    }
  }

  return items;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'error') {
    return (
      <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4v5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (severity === 'warning') {
    return (
      <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 1.5l6.5 12H1.5L8 1.5zM8 6v3.5M8 11.5h.01" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5h.01M7 7h1v4h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProblemsPanel() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverInfo, setServerInfo] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.diagnostics.get({});
      if (result.success && result.diagnostics) {
        setDiagnostics(parseDiagnostics(result.diagnostics));
      }
    } catch {
      // Diagnostics API may not be available
    }
    setLoading(false);
  }, []);

  const checkServers = useCallback(async () => {
    try {
      const result = await window.electronAPI.diagnostics.checkServers();
      if (result.success && result.servers) {
        const info = result.servers
          .map((s: { name: string; available: boolean }) => `${s.name}: ${s.available ? 'available' : 'not found'}`)
          .join(', ');
        setServerInfo(info);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkServers();
  }, [checkServers]);

  // Listen for diagnostics updates from main process
  useEffect(() => {
    const handler = () => {
      refresh();
    };
    window.electronAPI?.diagnostics?.onUpdate?.(handler);
    return () => {
      window.electronAPI?.diagnostics?.offUpdate?.(handler);
    };
  }, [refresh]);

  const errorCount = diagnostics.filter(d => d.severity === 'error').length;
  const warningCount = diagnostics.filter(d => d.severity === 'warning').length;

  return (
    <div className="h-full flex flex-col text-[12px]">
      {/* Toolbar */}
      <div className="h-7 flex items-center px-3 gap-3 border-b border-cp-border/50 shrink-0">
        <button
          onClick={refresh}
          disabled={loading}
          className="text-[11px] text-cp-text-dim hover:text-white transition-colors disabled:opacity-30"
          title="刷新诊断信息"
        >
          {loading ? '检查中...' : '刷新'}
        </button>

        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <SeverityIcon severity="error" />
            <span>{errorCount}</span>
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <SeverityIcon severity="warning" />
            <span>{warningCount}</span>
          </span>
        )}

        <div className="flex-1" />

        {serverInfo && (
          <span className="text-[10px] text-cp-text-dim/40 truncate max-w-[300px]" title={serverInfo}>
            {serverInfo}
          </span>
        )}
      </div>

      {/* Diagnostics list */}
      <div className="flex-1 overflow-y-auto">
        {diagnostics.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-cp-text-dim/40">
              {loading ? '正在检查...' : '没有问题'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {diagnostics.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-3 py-1 hover:bg-white/5 cursor-pointer"
                title={`${d.file}:${d.line}:${d.col}`}
              >
                <SeverityIcon severity={d.severity} />
                <span className="text-cp-text-dim/70 shrink-0 w-14 text-right font-mono">
                  {d.line}:{d.col}
                </span>
                <span className="flex-1 text-cp-text-dim truncate">
                  {d.message}
                </span>
                {d.code && (
                  <span className="text-cp-text-dim/30 shrink-0 font-mono">{d.code}</span>
                )}
                <span className="text-cp-text-dim/20 shrink-0 truncate max-w-[150px]" title={d.file}>
                  {d.file.split(/[/\\]/).pop()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
