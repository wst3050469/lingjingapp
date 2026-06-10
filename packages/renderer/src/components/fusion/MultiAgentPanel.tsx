import React, { useState, useEffect } from 'react';

interface AgentStatus {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  output: string;
  duration: number;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  running: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  timeout: 'bg-orange-100 text-orange-700',
};

export const MultiAgentPanel: React.FC = () => {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const status = await window.electronAPI?.invoke('fusion:parallel:status') as { healthy: boolean };
      setAgents([]);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">多Agent并行</h2>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          刷新
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">暂无活跃Agent实例</div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.taskId}
              className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{agent.taskId}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[agent.status]}`}>
                  {agent.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                耗时: {agent.duration}ms
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
