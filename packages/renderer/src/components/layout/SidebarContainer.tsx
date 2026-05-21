import { useState, lazy, Suspense } from 'react';
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
import { ErrorBoundary } from './ErrorBoundary';

const LazyFusionSettings = lazy(() => import('../fusion/FusionSettings').then(m => ({ default: m.FusionSettings })));
const LazyVectorMemoryPanel = lazy(() => import('../fusion/VectorMemoryPanel').then(m => ({ default: m.VectorMemoryPanel })));
const LazyDAGCanvas = lazy(() => import('../fusion/DAGCanvas').then(m => ({ default: m.DAGCanvas })));
const LazyMultiAgentPanel = lazy(() => import('../fusion/MultiAgentPanel').then(m => ({ default: m.MultiAgentPanel })));
const LazyModelRouterConfig = lazy(() => import('../fusion/ModelRouterConfig').then(m => ({ default: m.ModelRouterConfig })));
const LazyCronScheduleManager = lazy(() => import('../fusion/CronScheduleManager').then(m => ({ default: m.CronScheduleManager })));
const LazyReviewReportPanel = lazy(() => import('../fusion/ReviewReportPanel').then(m => ({ default: m.ReviewReportPanel })));
const LazyUserProfilePanel = lazy(() => import('../fusion/UserProfilePanel').then(m => ({ default: m.UserProfilePanel })));
const LazyOpenSpacePanel = lazy(() => import('../fusion/OpenSpacePanel').then(m => ({ default: m.OpenSpacePanel })));
const LazyOpenSpaceScriptEditor = lazy(() => import('../fusion/OpenSpaceScriptEditor').then(m => ({ default: m.OpenSpaceScriptEditor })));
const LazyOpenSpaceDatasetTree = lazy(() => import('../fusion/OpenSpaceDatasetTree').then(m => ({ default: m.OpenSpaceDatasetTree })));
const LazyOpenSpaceProfileManager = lazy(() => import('../fusion/OpenSpaceProfileManager').then(m => ({ default: m.OpenSpaceProfileManager })));
const LazyOpenSpaceRecorderPanel = lazy(() => import('../fusion/OpenSpaceRecorderPanel').then(m => ({ default: m.OpenSpaceRecorderPanel })));

const fusionFallback = <div className="flex items-center justify-center h-full text-cp-text-dim/50 text-sm">加载中...</div>;

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
      {activeSidebarPanel === 'chat' && (
        <ErrorBoundary fallback={
          <div className="h-full flex items-center justify-center">
            <div className="text-center px-4">
              <p className="text-cp-text-dim/60 text-sm">对话侧栏加载异常</p>
              <p className="text-cp-text-dim/40 text-xs mt-1">请尝试切换面板或刷新页面</p>
            </div>
          </div>
        }>
          <ChatSidebar />
        </ErrorBoundary>
      )}
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
      {activeSidebarPanel === 'fusion-settings' && <Suspense fallback={fusionFallback}><LazyFusionSettings /></Suspense>}
      {activeSidebarPanel === 'vector-memory' && <Suspense fallback={fusionFallback}><LazyVectorMemoryPanel /></Suspense>}
      {activeSidebarPanel === 'dag-canvas' && <Suspense fallback={fusionFallback}><LazyDAGCanvas /></Suspense>}
      {activeSidebarPanel === 'multi-agent' && <Suspense fallback={fusionFallback}><LazyMultiAgentPanel /></Suspense>}
      {activeSidebarPanel === 'model-router' && <Suspense fallback={fusionFallback}><LazyModelRouterConfig /></Suspense>}
      {activeSidebarPanel === 'cron-scheduler' && <Suspense fallback={fusionFallback}><LazyCronScheduleManager /></Suspense>}
      {activeSidebarPanel === 'review-report' && <Suspense fallback={fusionFallback}><LazyReviewReportPanel /></Suspense>}
      {activeSidebarPanel === 'user-profile' && <Suspense fallback={fusionFallback}><LazyUserProfilePanel /></Suspense>}
      {activeSidebarPanel === 'openspace' && <Suspense fallback={fusionFallback}><LazyOpenSpacePanel /></Suspense>}
      {activeSidebarPanel === 'openspace-script' && <Suspense fallback={fusionFallback}><LazyOpenSpaceScriptEditor /></Suspense>}
      {activeSidebarPanel === 'openspace-dataset' && <Suspense fallback={fusionFallback}><LazyOpenSpaceDatasetTree /></Suspense>}
      {activeSidebarPanel === 'openspace-profile' && <Suspense fallback={fusionFallback}><LazyOpenSpaceProfileManager /></Suspense>}
      {activeSidebarPanel === 'openspace-recorder' && <Suspense fallback={fusionFallback}><LazyOpenSpaceRecorderPanel /></Suspense>}
    </div>
  );
}
