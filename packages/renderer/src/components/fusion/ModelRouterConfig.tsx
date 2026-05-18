import React, { useState, useEffect } from 'react';

interface RouteRule {
  id: string;
  taskType: string;
  complexity?: 'low' | 'medium' | 'high';
  model: string;
  costBudget?: number;
  fallbackModel?: string;
  priority: number;
  enabled: boolean;
}

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}

export const ModelRouterConfig: React.FC = () => {
  const [rules, setRules] = useState<RouteRule[]>([]);
  const [auditLogs, setAuditLogs] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI?.invoke('fusion:router:rules') as RouteRule[];
      setRules(result ?? []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const fetchAudit = async () => {
    try {
      const logs = await window.electronAPI?.invoke('fusion:router:audit') as unknown[];
      setAuditLogs(logs ?? []);
    } catch {}
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleAddRule = async () => {
    const newRule = {
      taskType: 'general',
      model: 'default',
      priority: 0,
      enabled: true,
    };
    try {
      await window.electronAPI?.invoke('fusion:router:addRule', newRule);
      await fetchRules();
    } catch {}
  };

  const handleRemoveRule = async (id: string) => {
    try {
      await window.electronAPI?.invoke('fusion:router:removeRule', id);
      await fetchRules();
    } catch {}
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">模型路由配置</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowAudit(!showAudit); if (!showAudit) fetchAudit(); }}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {showAudit ? '路由规则' : '审计日志'}
          </button>
          <button
            onClick={handleAddRule}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            添加规则
          </button>
        </div>
      </div>

      {showAudit ? (
        <div className="space-y-2">
          {auditLogs.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">暂无审计日志</div>
          ) : (
            <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-80">
              {JSON.stringify(auditLogs, null, 2)}
            </pre>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {rule.taskType} → {rule.model}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  优先级: {rule.priority} | {rule.complexity ?? '任意'} | {rule.enabled ? '启用' : '禁用'}
                </div>
              </div>
              <button
                onClick={() => handleRemoveRule(rule.id)}
                className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                删除
              </button>
            </div>
          ))}
          {rules.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-4">暂无路由规则</div>
          )}
        </div>
      )}
    </div>
  );
};
