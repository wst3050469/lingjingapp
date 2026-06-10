import React, { useState, useEffect } from 'react';

interface Connector {
  id: string;
  type: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  config: any;
}

export const ConnectorPanel: React.FC = () => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    const loadConnectors = async () => {
      try {
        const result = await window.electronAPI?.connector?.list?.();
        setConnectors(result || []);
      } catch (error) {
        console.error('Failed to load connectors:', error);
      }
    };
    loadConnectors();
  }, []);

  const handleTestConnector = async (connectorId: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI?.connector?.test?.(connectorId);
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConfigureConnector = async (connectorId: string, config: any) => {
    try {
      await window.electronAPI?.connector?.configure?.(connectorId, config);
      setConnectors(prev => prev.map(c => 
        c.id === connectorId ? { ...c, config } : c
      ));
    } catch (error) {
      console.error('Failed to configure connector:', error);
    }
  };

  const handleRegisterConnector = async (type: string, config: any) => {
    try {
      const result = await window.electronAPI?.connector?.register?.({ type, ...config });
      if (result.success) {
        const newConnector: Connector = {
          id: result.connectorId!,
          type,
          name: config.name || type,
          status: 'disconnected',
          config,
        };
        setConnectors(prev => [...prev, newConnector]);
      }
    } catch (error) {
      console.error('Failed to register connector:', error);
    }
  };

  const handleUnregisterConnector = async (connectorId: string) => {
    try {
      await window.electronAPI?.connector?.unregister?.(connectorId);
      setConnectors(prev => prev.filter(c => c.id !== connectorId));
      setSelectedConnector(null);
    } catch (error) {
      console.error('Failed to unregister connector:', error);
    }
  };

  const getStatusColor = (status: Connector['status']) => {
    switch (status) {
      case 'connected': return '#10b981';
      case 'disconnected': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'http': return '🌐';
      case 'database': return '🗄️';
      case 'api': return '🔌';
      default: return '⚙️';
    }
  };

  return (
    <div className="connector-panel">
      <div className="header">
        <h2>Connector 管理</h2>
        <button
          onClick={() => {
            setSelectedConnector({
              id: 'new',
              type: 'http',
              name: '新连接器',
              status: 'disconnected',
              config: {},
            });
          }}
          className="btn-add"
        >
          + 添加连接器
        </button>
      </div>

      <div className="content">
        <div className="connectors-list">
          {connectors.map(connector => (
            <div
              key={connector.id}
              className={`connector-item ${selectedConnector?.id === connector.id ? 'selected' : ''}`}
              onClick={() => setSelectedConnector(connector)}
            >
              <div className="connector-icon">{getTypeIcon(connector.type)}</div>
              <div className="connector-info">
                <div className="connector-name">{connector.name}</div>
                <div className="connector-type">{connector.type}</div>
              </div>
              <div
                className="connector-status"
                style={{ backgroundColor: getStatusColor(connector.status) }}
              />
            </div>
          ))}
          {connectors.length === 0 && (
            <div className="empty-state">
              暂无连接器，点击右上角添加
            </div>
          )}
        </div>

        {selectedConnector && (
          <div className="connector-detail">
            <div className="detail-header">
              <h3>{selectedConnector.name}</h3>
              <span
                className="status-badge"
                style={{ backgroundColor: getStatusColor(selectedConnector.status) }}
              >
                {selectedConnector.status}
              </span>
            </div>

            <div className="detail-body">
              <div className="config-section">
                <h4>配置</h4>
                <pre className="config-preview">
                  {JSON.stringify(selectedConnector.config, null, 2)}
                </pre>
              </div>

              <div className="actions">
                <button
                  onClick={() => handleTestConnector(selectedConnector.id)}
                  disabled={isTesting}
                  className="btn-test"
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </button>
                {selectedConnector.id !== 'new' && (
                  <button
                    onClick={() => handleUnregisterConnector(selectedConnector.id)}
                    className="btn-delete"
                  >
                    删除连接器
                  </button>
                )}
              </div>

              {testResult && (
                <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                  <h4>测试结果</h4>
                  <pre>{JSON.stringify(testResult, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .connector-panel {
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
        .btn-add {
          padding: 8px 16px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        }
        .content {
          flex: 1;
          display: flex;
          gap: 20px;
          min-height: 0;
        }
        .connectors-list {
          width: 280px;
          overflow-y: auto;
          background: #0f172a;
          border-radius: 8px;
          padding: 12px;
        }
        .connector-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #1e293b;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          border: 1px solid transparent;
        }
        .connector-item.selected {
          border-color: #3b82f6;
        }
        .connector-icon {
          font-size: 24px;
        }
        .connector-info {
          flex: 1;
        }
        .connector-name {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .connector-type {
          font-size: 12px;
          color: #94a3b8;
        }
        .connector-status {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .empty-state {
          text-align: center;
          padding: 20px;
          color: #64748b;
        }
        .connector-detail {
          flex: 1;
          background: #0f172a;
          border-radius: 8px;
          padding: 20px;
          overflow-y: auto;
        }
        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
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
          gap: 20px;
        }
        .config-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
        }
        .config-preview {
          background: #1e293b;
          padding: 12px;
          border-radius: 6px;
          font-size: 13px;
          overflow-x: auto;
        }
        .actions {
          display: flex;
          gap: 12px;
        }
        .actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-test {
          background: #10b981;
          color: white;
        }
        .btn-test:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-delete {
          background: #ef4444;
          color: white;
        }
        .test-result {
          padding: 12px;
          border-radius: 6px;
        }
        .test-result.success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid #10b981;
        }
        .test-result.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid #ef4444;
        }
        .test-result h4 {
          margin: 0 0 8px 0;
        }
        .test-result pre {
          margin: 0;
          font-size: 12px;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
};
