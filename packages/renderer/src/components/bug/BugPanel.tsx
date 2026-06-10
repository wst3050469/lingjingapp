import React, { useEffect } from 'react';
import { useBugStore } from '../../stores/bug-store';

export function BugPanel() {
  const { bugs, knownBugs, loading, analyze, fix, verify } = useBugStore();

  useEffect(() => {
    analyze();
  }, []);

  const allBugs = [...knownBugs.map((kb: any) => ({ ...kb, isKnown: true })), ...bugs.map((b: any) => ({ ...b, isKnown: false }))];

  const severityColor: Record<string, string> = {
    CRITICAL: 'text-red-400',
    HIGH: 'text-orange-400',
    MEDIUM: 'text-yellow-400',
    LOW: 'text-blue-400',
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-200">缺陷管理</h2>
        <button onClick={() => analyze()} disabled={loading} className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50">
          {loading ? '分析中...' : '重新分析'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {allBugs.length === 0 ? (
          <p className="text-center text-sm text-gray-500">未发现缺陷</p>
        ) : (
          <div className="space-y-2">
            {allBugs.map((bug: any) => (
              <div key={bug.id} className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-xs font-medium ${severityColor[bug.severity] || 'text-gray-400'}`}>
                      {bug.severity}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">{bug.module}</span>
                    <p className="mt-1 text-sm text-gray-200">{bug.title}</p>
                  </div>
                  <div className="flex gap-1">
                    {bug.status !== 'fixed' && (
                      <button onClick={() => fix(bug.id)} className="rounded bg-green-600/20 px-2 py-0.5 text-xs text-green-400 hover:bg-green-600/30">
                        修复
                      </button>
                    )}
                    {bug.status === 'fixed' && (
                      <button onClick={() => verify(bug.id)} className="rounded bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400 hover:bg-blue-600/30">
                        验证
                      </button>
                    )}
                  </div>
                </div>
                {bug.description && <p className="mt-1 text-xs text-gray-400">{bug.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}