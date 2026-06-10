import React, { useEffect } from 'react';
import { useFusionStore } from '../../stores/fusion/useFusionStore';

const MODULE_LABELS: Record<string, string> = {
  eventBus: '事件总线',
  hookRegistry: 'Hook注册',
  slidingWindow: '滑动窗口',
  vectorMemory: '向量记忆',
  reviewEngine: '审查引擎',
  traceHarvester: '执行追踪',
  skillSecurity: '技能安全',
  dagOrchestrator: 'DAG编排',
  multiAgent: '多Agent并行',
  modelRouter: '模型路由',
  nlCron: 'Cron调度',
  userModeler: '用户画像',
};

export const FusionSettings: React.FC = () => {
  const { modules, loading, error, fetchHealth, toggleModule } = useFusionStore();

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">融合层设置</h2>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          刷新
        </button>
      </div>

      {error && (
        <div className="p-2 text-sm text-red-600 bg-red-50 rounded">{error}</div>
      )}

      <div className="space-y-2">
        {Object.entries(modules).map(([name, state]) => (
          <div
            key={name}
            className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  state.enabled && state.healthy
                    ? 'bg-green-500'
                    : state.enabled
                    ? 'bg-red-500'
                    : 'bg-gray-300'
                }`}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {MODULE_LABELS[name] ?? name}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={state.enabled}
                onChange={(e) => toggleModule(name, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500" />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
