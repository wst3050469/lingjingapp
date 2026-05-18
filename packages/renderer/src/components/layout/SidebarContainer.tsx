import { useState } from 'react';
import { useUIStore } from '../../stores/ui-store';
import { FileTree } from '../explorer/FileTree';
import { ChatSidebar } from '../sidebar/ChatSidebar';
import { SearchPanel } from '../search/SearchPanel';
import { GitPanel } from '../git/GitPanel';
import { RunDebugPanel } from '../run-debug/RunDebugPanel';
import { ExtensionPanel } from '../extension/ExtensionPanel';
import { RemotePanel } from '../remote/RemotePanel';
import { AdminPanel } from '../admin/AdminPanel';
import { WorkflowList, WorkflowEditor, WorkflowMonitor } from '../workflow';
import { PipelineEditor } from '../pipeline/PipelineEditor';
import { ReviewPanel } from '../review/ReviewPanel';
import { PMPanel } from '../pm/PMPanel';
import { SecurityPanel } from '../security/SecurityPanel';

function WorkflowPanel() {
  const [activeTab, setActiveTab] = useState<'list' | 'editor' | 'monitor'>('list');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 flex items-center gap-1 px-2 border-b border-cp-border">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-2 py-1 rounded text-xs ${activeTab === 'list' ? 'bg-cp-surface text-cp-text' : 'text-cp-text-dim/70'}`}
        >
          列表
        </button>
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-2 py-1 rounded text-xs ${activeTab === 'editor' ? 'bg-cp-surface text-cp-text' : 'text-cp-text-dim/70'}`}
        >
          编辑器
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-2 py-1 rounded text-xs ${activeTab === 'monitor' ? 'bg-cp-surface text-cp-text' : 'text-cp-text-dim/70'}`}
        >
          监控
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'list' && (
          <WorkflowList {...({ onSelectWorkflow: (id: string) => {
              setSelectedWorkflowId(id);
              setActiveTab('editor');
            } } as any)} />
        )}
        {activeTab === 'editor' && selectedWorkflowId && (
          <WorkflowEditor workflowId={selectedWorkflowId} />
        )}
        {activeTab === 'monitor' && selectedWorkflowId && (
          <WorkflowMonitor workflowId={selectedWorkflowId} />
        )}
      </div>
    </div>
  );
}

export function SidebarContainer() {
  const { activeSidebarPanel } = useUIStore();

  return (
    <div className="h-full bg-cp-sidebar flex flex-col overflow-hidden">
      {activeSidebarPanel === 'explorer' && <FileTree />}
      {activeSidebarPanel === 'search' && <SearchPanel />}
      {activeSidebarPanel === 'chat' && <ChatSidebar />}
      {activeSidebarPanel === 'git' && <GitPanel />}
      {activeSidebarPanel === 'run-debug' && <RunDebugPanel />}
      {activeSidebarPanel === 'extension' && <ExtensionPanel />}
      {activeSidebarPanel === 'remote' && <RemotePanel />}
      {activeSidebarPanel === 'admin' && <AdminPanel />}
      {activeSidebarPanel === 'workflow' && <WorkflowPanel />}
      {activeSidebarPanel === 'pipeline' && <PipelineEditor projectPath={window.__codepilot_project_path__ || ''} />}
      {activeSidebarPanel === 'review' && <ReviewPanel projectPath={window.__codepilot_project_path__ || ''} />}
      {activeSidebarPanel === 'pm' && <PMPanel projectPath={window.__codepilot_project_path__ || ''} />}
      {activeSidebarPanel === 'security' && <SecurityPanel projectPath={window.__codepilot_project_path__ || ''} />}
    </div>
  );
}
