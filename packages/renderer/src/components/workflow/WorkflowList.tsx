import React, { useState, useEffect } from 'react';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
}

interface WorkflowInstance {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export const WorkflowList: React.FC = () => {
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [templates] = useState<WorkflowTemplate[]>([
    {
      id: 'template-1',
      name: '标准开发流程',
      description: '需求分析 → 设计 → 实现 → 验证',
      category: '开发',
      icon: '🚀',
    },
    {
      id: 'template-2',
      name: '快速原型',
      description: '快速迭代原型开发',
      category: '开发',
      icon: '⚡',
    },
    {
      id: 'template-3',
      name: '代码审查',
      description: '自动化代码审查流程',
      category: '质量',
      icon: '🔍',
    },
    {
      id: 'template-4',
      name: '文档生成',
      description: '自动生成技术文档',
      category: '文档',
      icon: '📄',
    },
  ]);
  
  const [activeTab, setActiveTab] = useState<'instances' | 'templates'>('instances');
  const [searchQuery, setSearchQuery] = useState('');

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
    
    // 监听工作流创建事件
    const unsubscribe = window.electronAPI?.agent?.onEvent?.((event: any) => {
      if (event.type === 'workflow_started') {
        console.log('Workflow started:', event);
        // 自动刷新工作流列表
        setTimeout(() => loadInstances(), 1000);
        // 切换到实例标签
        setActiveTab('instances');
      } else if (event.type === 'workflow_progress') {
        // 更新工作流进度
        loadInstances();
      }
    });
    
    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleCreateFromTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    console.log('Creating workflow from template:', template.name);
  };

  const handleStartWorkflow = async (instanceId: string) => {
    console.log('Starting workflow:', instanceId);
  };

  const handlePauseWorkflow = async (instanceId: string) => {
    console.log('Pausing workflow:', instanceId);
  };

  const handleDeleteWorkflow = async (instanceId: string) => {
    console.log('Deleting workflow:', instanceId);
  };

  const getStatusColor = (status: WorkflowInstance['status']) => {
    switch (status) {
      case 'running': return '#10b981';
      case 'paused': return '#f59e0b';
      case 'completed': return '#3b82f6';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const filteredInstances = instances.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="workflow-list">
      <div className="header">
        <h2>工作流管理</h2>
        <input
          type="text"
          placeholder="搜索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'instances' ? 'active' : ''}`}
          onClick={() => setActiveTab('instances')}
        >
          工作流实例 ({instances.length})
        </button>
        <button
          className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          模板库 ({templates.length})
        </button>
      </div>

      <div className="content">
        {activeTab === 'instances' && (
          <div className="instances-grid">
            {filteredInstances.length === 0 ? (
              <div className="empty-state">
                <p>暂无工作流实例</p>
                <p>从模板库创建一个新工作流吧！</p>
              </div>
            ) : (
              filteredInstances.map(instance => (
                <div key={instance.id} className="instance-card">
                  <div className="card-header">
                    <h3>{instance.name}</h3>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(instance.status) }}
                    >
                      {instance.status}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="time-info">
                      创建: {instance.createdAt.toLocaleString()}
                    </div>
                    <div className="time-info">
                      更新: {instance.updatedAt.toLocaleString()}
                    </div>
                  </div>
                  <div className="card-actions">
                    {instance.status === 'running' && (
                      <button 
                        onClick={() => handlePauseWorkflow(instance.id)}
                        className="btn-pause"
                      >
                        暂停
                      </button>
                    )}
                    {instance.status === 'paused' && (
                      <button 
                        onClick={() => handleStartWorkflow(instance.id)}
                        className="btn-start"
                      >
                        恢复
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteWorkflow(instance.id)}
                      className="btn-delete"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="templates-grid">
            {filteredTemplates.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-icon">{template.icon}</div>
                <div className="template-content">
                  <h3>{template.name}</h3>
                  <p className="template-desc">{template.description}</p>
                  <span className="template-category">{template.category}</span>
                </div>
                <button
                  onClick={() => handleCreateFromTemplate(template.id)}
                  className="btn-create"
                >
                  创建工作流
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .workflow-list {
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
        .search-input {
          padding: 8px 12px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #e2e8f0;
          width: 240px;
        }
        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .tab {
          padding: 8px 16px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #94a3b8;
          cursor: pointer;
        }
        .tab.active {
          background: #334155;
          color: #e2e8f0;
          border-color: #3b82f6;
        }
        .content {
          flex: 1;
          overflow-y: auto;
        }
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #64748b;
        }
        .instances-grid, .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .instance-card, .template-card {
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 16px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .card-header h3 {
          margin: 0;
          font-size: 16px;
        }
        .status-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          color: white;
          text-transform: uppercase;
        }
        .card-body {
          margin-bottom: 12px;
        }
        .time-info {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .card-actions {
          display: flex;
          gap: 8px;
        }
        .card-actions button {
          flex: 1;
          padding: 6px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        .btn-start { background: #10b981; color: white; }
        .btn-pause { background: #f59e0b; color: white; }
        .btn-delete { background: #ef4444; color: white; }
        .template-icon {
          font-size: 32px;
          text-align: center;
          margin-bottom: 12px;
        }
        .template-content h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
        }
        .template-desc {
          font-size: 13px;
          color: #94a3b8;
          margin: 0 0 8px 0;
        }
        .template-category {
          display: inline-block;
          padding: 2px 8px;
          background: #334155;
          border-radius: 4px;
          font-size: 12px;
        }
        .btn-create {
          width: 100%;
          margin-top: 12px;
          padding: 8px;
          background: #3b82f6;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
