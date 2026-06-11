import React, { useState, useEffect } from 'react';

interface PhaseInfo {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: Date;
  endTime?: Date;
}

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface WorkflowMonitorProps {
  workflowId: string;
}

export const WorkflowMonitor: React.FC<WorkflowMonitorProps> = ({ workflowId }) => {
  const [phases, setPhases] = useState<PhaseInfo[]>([
    { name: '需求分析', status: 'completed', progress: 100 },
    { name: '设计', status: 'completed', progress: 100 },
    { name: '实现', status: 'running', progress: 45 },
    { name: '验证', status: 'pending', progress: 0 },
  ]);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [overallProgress, setOverallProgress] = useState(65);

  useEffect(() => {
    const handleProgress = (data: any) => {
      setOverallProgress(data.progress);
      if (data.phase) {
        setPhases(prev => prev.map(p => 
          p.name === data.phase.name ? { ...p, ...data.phase } : p
        ));
      }
    };

    const handleLog = (data: any) => {
      setLogs(prev => [...prev, {
        timestamp: new Date(),
        level: data.level || 'info',
        message: data.message,
      }]);
    };

    const progressCleanup = window.electronAPI?.workflow?.onProgress?.(handleProgress);
    const logCleanup = window.electronAPI?.workflow?.onLog?.(handleLog);

    return () => {
      progressCleanup?.();
      logCleanup?.();
    };
  }, []);

  const getStatusColor = (status: PhaseInfo['status']) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'running': return '#3b82f6';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: PhaseInfo['status']) => {
    switch (status) {
      case 'completed': return '✓';
      case 'running': return '▶';
      case 'failed': return '✕';
      default: return '○';
    }
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return '#ef4444';
      case 'warn': return '#f59e0b';
      default: return '#94a3b8';
    }
  };

  return (
    <div className="workflow-monitor">
      <div className="header">
        <h2>工作流监控</h2>
        <span className="workflow-id">ID: {workflowId}</span>
      </div>

      <div className="overall-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <span className="progress-text">{overallProgress}%</span>
      </div>

      <div className="phases-section">
        <h3>阶段执行状态</h3>
        <div className="phases-list">
          {phases.map((phase, index) => (
            <div key={index} className={`phase-item ${phase.status}`}>
              <div className="phase-icon" style={{ color: getStatusColor(phase.status) }}>
                {getStatusIcon(phase.status)}
              </div>
              <div className="phase-content">
                <div className="phase-header">
                  <span className="phase-name">{phase.name}</span>
                  <span className="phase-status" style={{ color: getStatusColor(phase.status) }}>
                    {phase.status}
                  </span>
                </div>
                {phase.status === 'running' && (
                  <div className="phase-progress">
                    <div className="phase-progress-bar">
                      <div 
                        className="phase-progress-fill"
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>
                    <span>{phase.progress}%</span>
                  </div>
                )}
                {phase.startTime && (
                  <div className="phase-time">
                    开始: {phase.startTime.toLocaleTimeString()}
                    {phase.endTime && ` | 结束: ${phase.endTime.toLocaleTimeString()}`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="logs-section">
        <h3>执行日志</h3>
        <div className="logs-container">
          {logs.map((log, index) => (
            <div key={index} className="log-entry">
              <span className="log-time">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <span className="log-level" style={{ color: getLevelColor(log.level) }}>
                [{log.level.toUpperCase()}]
              </span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="logs-empty">暂无日志</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .workflow-monitor {
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
        .workflow-id {
          font-size: 14px;
          color: #94a3b8;
        }
        .overall-progress {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .progress-bar {
          flex: 1;
          height: 8px;
          background: #334155;
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #10b981);
          transition: width 0.3s;
        }
        .progress-text {
          font-size: 14px;
          font-weight: 600;
        }
        .phases-section {
          margin-bottom: 24px;
        }
        .phases-section h3 {
          font-size: 16px;
          margin-bottom: 12px;
        }
        .phases-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .phase-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #0f172a;
          border-radius: 8px;
          border-left: 3px solid;
        }
        .phase-item.completed { border-left-color: #10b981; }
        .phase-item.running { border-left-color: #3b82f6; }
        .phase-item.failed { border-left-color: #ef4444; }
        .phase-item.pending { border-left-color: #6b7280; }
        .phase-icon {
          font-size: 20px;
          display: flex;
          align-items: center;
        }
        .phase-content {
          flex: 1;
        }
        .phase-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .phase-name {
          font-weight: 600;
        }
        .phase-status {
          font-size: 12px;
          text-transform: uppercase;
        }
        .phase-progress {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .phase-progress-bar {
          flex: 1;
          height: 4px;
          background: #334155;
          border-radius: 2px;
          overflow: hidden;
        }
        .phase-progress-fill {
          height: 100%;
          background: #3b82f6;
          transition: width 0.3s;
        }
        .phase-time {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }
        .logs-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .logs-section h3 {
          font-size: 16px;
          margin-bottom: 12px;
        }
        .logs-container {
          flex: 1;
          overflow-y: auto;
          background: #0f172a;
          border-radius: 8px;
          padding: 12px;
          font-family: monospace;
          font-size: 13px;
        }
        .log-entry {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
        }
        .log-time {
          color: #64748b;
        }
        .log-level {
          font-weight: 600;
        }
        .log-message {
          flex: 1;
        }
        .logs-empty {
          color: #64748b;
          text-align: center;
          padding: 20px;
        }
      `}</style>
    </div>
  );
};
