import React, { useState, useEffect } from 'react';

interface WorkflowInstance {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowListProps {
  onSelectWorkflow?: (id: string) => void;
}

export const WorkflowList: React.FC<WorkflowListProps> = ({ onSelectWorkflow }) => {
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);

  const loadInstances = async () => {
    try {
      const result = await window.electronAPI?.workflow?.list?.();
      setInstances(result || []);
    } catch (error) {
      console.error('Failed to load workflow instances:', error);
    }
  };

  useEffect(() => {
    loadInstances();

    // 监听工作流事件，自动刷新列表
    const unsubscribe = window.electronAPI?.agent?.onEvent?.((event: any) => {
      if (event.type === 'workflow_started' || event.type === 'workflow_progress') {
        loadInstances();
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const getStatusColor = (status: WorkflowInstance['status']) => {
    switch (status) {
      case 'running': return '#10b981';
      case 'paused': return '#f59e0b';
      case 'completed': return '#3b82f6';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: WorkflowInstance['status']) => {
    switch (status) {
      case 'running': return '运行中';
      case 'paused': return '已暂停';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      default: return '未知';
    }
  };

  const runningCount = instances.filter(i => i.status === 'running').length;
  const completedCount = instances.filter(i => i.status === 'completed').length;
  const failedCount = instances.filter(i => i.status === 'failed').length;

  return (
    <div className="workflow-list">
      {/* 统计概览 */}
      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-dot" style={{ backgroundColor: '#10b981' }} />
          <span className="summary-text">{runningCount} 运行中</span>
        </div>
        <div className="summary-item">
          <span className="summary-dot" style={{ backgroundColor: '#3b82f6' }} />
          <span className="summary-text">{completedCount} 已完成</span>
        </div>
        <div className="summary-item">
          <span className="summary-dot" style={{ backgroundColor: '#ef4444' }} />
          <span className="summary-text">{failedCount} 失败</span>
        </div>
      </div>

      {/* 工作流实例列表 */}
      <div className="instances-list">
        {instances.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p className="empty-title">暂无工作流</p>
            <p className="empty-desc">
              当你在 Quest 模式中提交复杂任务时，工作流将自动创建并在后台执行。
              <br />
              您可以在此查看实时进度。
            </p>
          </div>
        ) : (
          instances.map(instance => (
            <button
              key={instance.id}
              onClick={() => onSelectWorkflow?.(instance.id)}
              className="instance-row"
            >
              <div className="instance-left">
                <span
                  className="status-dot"
                  style={{ backgroundColor: getStatusColor(instance.status) }}
                />
                <div className="instance-info">
                  <span className="instance-name">{instance.name}</span>
                  <span className="instance-time">
                    {instance.createdAt.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="instance-right">
                <span
                  className="status-label"
                  style={{ color: getStatusColor(instance.status) }}
                >
                  {getStatusLabel(instance.status)}
                </span>
                {instance.status === 'running' && (
                  <span className="view-hint">查看 →</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <style jsx>{`
        .workflow-list {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e293b;
          color: #e2e8f0;
          overflow: hidden;
        }
        .summary-bar {
          display: flex;
          gap: 16px;
          padding: 12px 16px;
          background: #0f172a;
          border-bottom: 1px solid #334155;
        }
        .summary-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .summary-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .summary-text {
          font-size: 12px;
          color: #94a3b8;
        }
        .instances-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        .instance-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 12px 16px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
          color: inherit;
        }
        .instance-row:hover {
          border-color: #3b82f6;
          background: #1e293b;
        }
        .instance-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .instance-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .instance-name {
          font-size: 14px;
          font-weight: 500;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .instance-time {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .instance-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .status-label {
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
        }
        .view-hint {
          font-size: 11px;
          color: #64748b;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          padding: 24px;
        }
        .empty-icon {
          font-size: 40px;
          margin-bottom: 12px;
          opacity: 0.5;
        }
        .empty-title {
          font-size: 14px;
          color: #94a3b8;
          margin-bottom: 8px;
        }
        .empty-desc {
          font-size: 12px;
          color: #64748b;
          line-height: 1.6;
          max-width: 280px;
        }
      `}</style>
    </div>
  );
};
