import React, { useState, useEffect } from 'react';

interface CronSchedule {
  id: string;
  cronExpression: string;
  naturalLanguage: string;
  task: string;
  nextRunAt: number;
  enabled: boolean;
}

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}

export const CronScheduleManager: React.FC = () => {
  const [schedules, setSchedules] = useState<CronSchedule[]>([]);
  const [nlInput, setNlInput] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [preview, setPreview] = useState<{ cron: string; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSchedules = async () => {
    try {
      const result = await window.electronAPI?.invoke('fusion:cron:list') as CronSchedule[];
      setSchedules(result ?? []);
    } catch {}
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handlePreview = async () => {
    if (!nlInput.trim()) return;
    try {
      const result = await window.electronAPI?.invoke('fusion:cron:preview', nlInput) as { cron: string; error?: string };
      setPreview(result);
    } catch {
      setPreview({ cron: '', error: '预览失败' });
    }
  };

  const handleSchedule = async () => {
    if (!nlInput.trim() || !taskInput.trim()) return;
    setLoading(true);
    try {
      await window.electronAPI?.invoke('fusion:cron:schedule', nlInput, taskInput);
      setNlInput('');
      setTaskInput('');
      setPreview(null);
      await fetchSchedules();
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await window.electronAPI?.invoke('fusion:cron:cancel', id);
      await fetchSchedules();
    } catch {}
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cron调度管理</h2>

      <div className="space-y-2">
        <input
          type="text"
          value={nlInput}
          onChange={(e) => setNlInput(e.target.value)}
          placeholder="自然语言输入（如：每天、每小时、每5分钟）"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <input
          type="text"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="任务描述"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            预览Cron
          </button>
          <button
            onClick={handleSchedule}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            创建调度
          </button>
        </div>
        {preview && (
          <div className={`p-2 text-sm rounded ${preview.error ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
            {preview.error ?? `Cron表达式: ${preview.cron}`}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {schedules.map((schedule) => (
          <div
            key={schedule.id}
            className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{schedule.naturalLanguage}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {schedule.cronExpression} | 任务: {schedule.task} | 下次: {new Date(schedule.nextRunAt).toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => handleCancel(schedule.id)}
              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            >
              取消
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
