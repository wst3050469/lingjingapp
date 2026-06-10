import React, { useState, useEffect } from 'react';

interface BatchTask {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  createdAt: Date;
  result?: any;
}

export const BatchTaskPanel: React.FC = () => {
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<BatchTask | null>(null);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const result = await window.electronAPI?.batch?.list?.();
        setTasks(result || []);
      } catch (error) {
        console.error('Failed to load batch tasks:', error);
      }
    };
    loadTasks();

    const progressCleanup = window.electronAPI?.batch?.onProgress?.((data: any) => {
      setTasks(prev => prev.map(t => 
        t.id === data.taskId ? { ...t, progress: data.progress, status: 'running' } : t
      ));
    });

    const completeCleanup = window.electronAPI?.batch?.onComplete?.((data: any) => {
      setTasks(prev => prev.map(t => 
        t.id === data.taskId ? { ...t, status: 'completed', result: data.result, progress: 100 } : t
      ));
    });

    const errorCleanup = window.electronAPI?.batch?.onError?.((data: any) => {
      setTasks(prev => prev.map(t => 
        t.id === data.taskId ? { ...t, status: 'failed' } : t
      ));
    });

    return () => {
      progressCleanup?.();
      completeCleanup?.();
      errorCleanup?.();
    };
  }, []);

  const handleCancelTask = async (taskId: string) => {
    try {
      await window.electronAPI?.batch?.cancel?.(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  };

  const handlePauseTask = async (taskId: string) => {
    try {
      await window.electronAPI?.batch?.pause?.(taskId);
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'paused' } : t
      ));
    } catch (error) {
      console.error('Failed to pause task:', error);
    }
  };

  const handleResumeTask = async (taskId: string) => {
    try {
      await window.electronAPI?.batch?.resume?.(taskId);
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'running' } : t
      ));
    } catch (error) {
      console.error('Failed to resume task:', error);
    }
  };

  const handleGetResult = async (taskId: string) => {
    try {
      const result = await window.electronAPI?.batch?.getResult?.(taskId);
      setSelectedTask(prev => prev ? { ...prev, result } : null);
    } catch (error) {
      console.error('Failed to get result:', error);
    }
  };

  const getStatusColor = (status: BatchTask['status']) => {
    switch (status) {
      case 'pending': return '#6b7280';
      case 'running': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'paused': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed');

  return (
    <div className="batch-task-panel">
      <div className="header">
        <h2>批量任务管理</h2>
        <div className="stats">
          <span>运行中: {tasks.filter(t => t.status === 'running').length}</span>
          <span>排队中: {tasks.filter(t => t.status === 'pending').length}</span>
          <span>已完成: {tasks.filter(t => t.status === 'completed').length}</span>
        </div>
      </div>

      <div className="content">
        <div className="tasks-section">
          <h3>活动任务</h3>
          <div className="tasks-list">
            {activeTasks.length === 0 ? (
              <div className="empty-state">暂无活动任务</div>
            ) : (
              activeTasks.map(task => (
                <div
                  key={task.id}
                  className={`task-item ${selectedTask?.id === task.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="task-header">
                    <span className="task-name">{task.name}</span>
                    <span
                      className="task-status"
                      style={{ color: getStatusColor(task.status) }}
                    >
                      {task.status}
                    </span>
                  </div>
                  {task.status === 'running' && (
                    <div className="task-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="progress-text">{task.progress}%</span>
                    </div>
                  )}
                  <div className="task-actions">
                    {task.status === 'running' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePauseTask(task.id); }}
                        className="btn-pause"
                      >
                        暂停
                      </button>
                    )}
                    {task.status === 'paused' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResumeTask(task.id); }}
                        className="btn-resume"
                      >
                        恢复
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelTask(task.id); }}
                      className="btn-cancel"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="tasks-section">
          <h3>历史记录</h3>
          <div className="tasks-list">
            {completedTasks.length === 0 ? (
              <div className="empty-state">暂无历史记录</div>
            ) : (
              completedTasks.map(task => (
                <div
                  key={task.id}
                  className={`task-item ${selectedTask?.id === task.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="task-header">
                    <span className="task-name">{task.name}</span>
                    <span
                      className="task-status"
                      style={{ color: getStatusColor(task.status) }}
                    >
                      {task.status}
                    </span>
                  </div>
                  <div className="task-time">
                    {task.createdAt.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedTask && (
          <div className="task-detail">
            <div className="detail-header">
              <h3>{selectedTask.name}</h3>
              <span
                className="status-badge"
                style={{ backgroundColor: getStatusColor(selectedTask.status) }}
              >
                {selectedTask.status}
              </span>
            </div>
            <div className="detail-body">
              <div className="detail-info">
                <div>任务ID: {selectedTask.id}</div>
                <div>创建时间: {selectedTask.createdAt.toLocaleString()}</div>
                {selectedTask.status === 'running' && (
                  <div>进度: {selectedTask.progress}%</div>
                )}
              </div>
              {selectedTask.result && (
                <div className="result-section">
                  <h4>执行结果</h4>
                  <pre>{JSON.stringify(selectedTask.result, null, 2)}</pre>
                </div>
              )}
              {selectedTask.status === 'completed' && !selectedTask.result && (
                <button
                  onClick={() => handleGetResult(selectedTask.id)}
                  className="btn-result"
                >
                  获取结果
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .batch-task-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e293b;
          padding: 20px;
          color: #e2e8f0;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .header h2 {
          margin: 0;
          font-size: 20px;
        }
        .stats {
          display: flex;
          gap: 16px;
          font-size: 14px;
          color: #94a3b8;
        }
        .content {
          flex: 1;
          display: flex;
          gap: 20px;
          min-height: 0;
        }
        .tasks-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .tasks-section h3 {
          font-size: 16px;
          margin-bottom: 12px;
        }
        .tasks-list {
          flex: 1;
          overflow-y: auto;
          background: #0f172a;
          border-radius: 8px;
          padding: 12px;
        }
        .empty-state {
          text-align: center;
          padding: 20px;
          color: #64748b;
        }
        .task-item {
          padding: 12px;
          background: #1e293b;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          border: 1px solid transparent;
        }
        .task-item.selected {
          border-color: #3b82f6;
        }
        .task-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .task-name {
          font-weight: 600;
        }
        .task-status {
          font-size: 12px;
          text-transform: uppercase;
        }
        .task-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .progress-bar {
          flex: 1;
          height: 6px;
          background: #334155;
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #3b82f6;
          transition: width 0.3s;
        }
        .progress-text {
          font-size: 12px;
          min-width: 40px;
          text-align: right;
        }
        .task-actions {
          display: flex;
          gap: 8px;
        }
        .task-actions button {
          padding: 4px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-pause { background: #f59e0b; color: white; }
        .btn-resume { background: #10b981; color: white; }
        .btn-cancel { background: #ef4444; color: white; }
        .task-time {
          font-size: 12px;
          color: #64748b;
        }
        .task-detail {
          width: 360px;
          background: #0f172a;
          border-radius: 8px;
          padding: 20px;
          overflow-y: auto;
        }
        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .detail-header h3 {
          margin: 0;
        }
        .status-badge {
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          color: white;
          text-transform: uppercase;
        }
        .detail-body {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .detail-info {
          font-size: 14px;
          line-height: 1.8;
        }
        .result-section h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
        }
        .result-section pre {
          margin: 0;
          padding: 12px;
          background: #1e293b;
          border-radius: 6px;
          font-size: 12px;
          overflow-x: auto;
        }
        .btn-result {
          width: 100%;
          padding: 8px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
