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
import { WorkflowList, WorkflowMonitor } from '../workflow';
import { ErrorBoundary } from './ErrorBoundary';

const LazyFusionSettings = lazy(() => import('../fusion/FusionSettings').then(m => ({ default: m.FusionSettings })));
const LazyVectorMemoryPanel = lazy(() => import('../fusion/VectorMemoryPanel').then(m => ({ default: m.VectorMemoryPanel })));
const LazyDAGCanvas = lazy(() => import('../fusion/DAGCanvas').then(m => ({ default: m.DAGCanvas })));
const LazyMultiAgentPanel = lazy(() => import('../fusion/MultiAgentPanel').then(m => ({ default: m.MultiAgentPanel })));
const LazyModelRouterConfig = lazy(() => import('../fusion/ModelRouterConfig').then(m => ({ default: m.ModelRouterConfig })));
const LazyCronScheduleManager = lazy(() => import('../fusion/CronScheduleManager').then(m => ({ default: m.CronScheduleManager })));
const LazyReviewReportPanel = lazy(() => import('../fusion/ReviewReportPanel').then(m => ({ default: m.ReviewReportPanel })));
const LazyUserProfilePanel = lazy(() => import('../fusion/UserProfilePanel').then(m => ({ default: m.UserProfilePanel })));

const fusionFallback = <div className="flex items-center justify-center h-full text-cp-text-dim/50 text-sm">加载中...</div>;

function WorkflowPanel() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 flex items-center px-3 border-b border-cp-border">
        <span className="text-xs text-cp-text font-medium">工作流监控</span>
        {selectedWorkflowId && (
          <button
            onClick={() => setSelectedWorkflowId(null)}
            className="ml-auto text-[10px] text-cp-text-dim hover:text-cp-text"
          >
            ← 返回列表
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        {selectedWorkflowId ? (
          <WorkflowMonitor workflowId={selectedWorkflowId} />
        ) : (
          <WorkflowList onSelectWorkflow={(id: string) => setSelectedWorkflowId(id)} />
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
      {activeSidebarPanel === 'fusion-settings' && <Suspense fallback={fusionFallback}><LazyFusionSettings /></Suspense>}
      {activeSidebarPanel === 'vector-memory' && <Suspense fallback={fusionFallback}><LazyVectorMemoryPanel /></Suspense>}
      {activeSidebarPanel === 'dag-canvas' && <Suspense fallback={fusionFallback}><LazyDAGCanvas /></Suspense>}
      {activeSidebarPanel === 'multi-agent' && <Suspense fallback={fusionFallback}><LazyMultiAgentPanel /></Suspense>}
      {activeSidebarPanel === 'model-router' && <Suspense fallback={fusionFallback}><LazyModelRouterConfig /></Suspense>}
      {activeSidebarPanel === 'cron-scheduler' && <Suspense fallback={fusionFallback}><LazyCronScheduleManager /></Suspense>}
      {activeSidebarPanel === 'review-report' && <Suspense fallback={fusionFallback}><LazyReviewReportPanel /></Suspense>}
      {activeSidebarPanel === 'user-profile' && <Suspense fallback={fusionFallback}><LazyUserProfilePanel /></Suspense>}
    </div>
  );
}
