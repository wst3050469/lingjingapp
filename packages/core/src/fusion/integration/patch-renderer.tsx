/**
 * Fusion & OpenSpace Renderer UI 路由注册补丁
 *
 * 集成说明：
 * 1. ActivityBar.tsx → 在 sidebarIcons 数组中追加 Fusion/OpenSpace 图标按钮
 * 2. SidebarContainer.tsx → 在条件渲染中追加面板路由 (activeSidebarPanel === 'xxx' && <Component/>)
 * 3. ui-store.ts → 扩展 SidebarPanel 联合类型，添加 Fusion/OpenSpace 面板 ID
 */

import React from 'react';

// ─── Fusion 侧栏面板注册 ────────────────────────────────────────

export interface SidebarPanelDef {
  id: string;
  icon: string;
  label: string;
  component: string;
}

export const FUSION_SIDEBAR_PANELS: Record<string, SidebarPanelDef> = {
  fusion: { id: 'fusion', icon: '⚡', label: '融合增强', component: 'FusionSettings' },
  vectorMemory: { id: 'vector-memory', icon: '🧠', label: '向量记忆', component: 'VectorMemoryPanel' },
  dag: { id: 'dag-orchestrator', icon: '🔀', label: 'DAG编排', component: 'DAGCanvas' },
  multiAgent: { id: 'multi-agent', icon: '👥', label: '多Agent', component: 'MultiAgentPanel' },
  modelRouter: { id: 'model-router', icon: '🧭', label: '模型路由', component: 'ModelRouterConfig' },
  cronSchedule: { id: 'cron-schedule', icon: '⏰', label: 'Cron调度', component: 'CronScheduleManager' },
  reviewReport: { id: 'review-report', icon: '🔍', label: '审查报告', component: 'ReviewReportPanel' },
  userProfile: { id: 'user-profile', icon: '👤', label: '用户画像', component: 'UserProfilePanel' },
};

// ─── OpenSpace 侧栏面板注册 ─────────────────────────────────────

export const OPENSPACE_SIDEBAR_PANELS: Record<string, SidebarPanelDef> = {
  openspace: { id: 'openspace', icon: '🌌', label: 'OpenSpace', component: 'OpenSpacePanel' },
  openspaceScript: { id: 'openspace-script', icon: '📝', label: 'OS脚本', component: 'OpenSpaceScriptEditor' },
  openspaceDataset: { id: 'openspace-dataset', icon: '📁', label: 'OS数据集', component: 'OpenSpaceDatasetTree' },
  openspaceProfile: { id: 'openspace-profile', icon: '🎯', label: 'OS场景', component: 'OpenSpaceProfileManager' },
  openspaceRecorder: { id: 'openspace-recorder', icon: '🎬', label: 'OS录制', component: 'OpenSpaceRecorderPanel' },
};

// ─── 面板组件映射（懒加载） ──────────────────────────────────────

const LazyFusionSettings = React.lazy(() =>
  import('../../../../renderer/src/components/fusion/FusionSettings.js').then((m) => ({ default: m.FusionSettings }))
);
const LazyVectorMemoryPanel = React.lazy(() =>
  import('../../../../renderer/src/components/fusion/VectorMemoryPanel.js').then((m) => ({ default: m.VectorMemoryPanel }))
);
const LazyDAGCanvas = React.lazy(() =>
  import('../../../../renderer/src/components/fusion/DAGCanvas.js').then((m) => ({ default: m.DAGCanvas }))
);
const LazyMultiAgentPanel = React.lazy(() =>
  import('../../../../renderer/src/components/fusion/MultiAgentPanel.js').then((m) => ({ default: m.MultiAgentPanel }))
);
const LazyModelRouterConfig = React.lazy(() =>
  import('../../../../renderer/src/components/fusion/ModelRouterConfig.js').then((m) => ({ default: m.ModelRouterConfig }))
);
const LazyCronScheduleManager = React.lazy(() =>
  import('../../../../renderer/src/components/fusion/CronScheduleManager.js').then((m) => ({ default: m.CronScheduleManager }))
);
const LazyReviewReportPanel = React.lazy(() =>
  import('../../../../renderer/src/components/fusion/ReviewReportPanel.js').then((m) => ({ default: m.ReviewReportPanel }))
);
const LazyUserProfilePanel = React.lazy(() =>
  import('../../../../renderer/src/components/fusion/UserProfilePanel.js').then((m) => ({ default: m.UserProfilePanel }))
);

export const FUSION_PANEL_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
  FusionSettings: LazyFusionSettings,
  VectorMemoryPanel: LazyVectorMemoryPanel,
  DAGCanvas: LazyDAGCanvas,
  MultiAgentPanel: LazyMultiAgentPanel,
  ModelRouterConfig: LazyModelRouterConfig,
  CronScheduleManager: LazyCronScheduleManager,
  ReviewReportPanel: LazyReviewReportPanel,
  UserProfilePanel: LazyUserProfilePanel,
};

const LazyOpenSpacePanel = React.lazy(() =>
  import('../../../../renderer/src/components/openspace/OpenSpacePanel.js').then((m) => ({ default: m.OpenSpacePanel }))
);
const LazyOpenSpaceScriptEditor = React.lazy(() =>
  import('../../../../renderer/src/components/openspace/OpenSpaceScriptEditor.js').then((m) => ({ default: m.OpenSpaceScriptEditor }))
);
const LazyOpenSpaceDatasetTree = React.lazy(() =>
  import('../../../../renderer/src/components/openspace/OpenSpaceDatasetTree.js').then((m) => ({ default: m.OpenSpaceDatasetTree }))
);
const LazyOpenSpaceProfileManager = React.lazy(() =>
  import('../../../../renderer/src/components/openspace/OpenSpaceProfileManager.js').then((m) => ({ default: m.OpenSpaceProfileManager }))
);
const LazyOpenSpaceRecorderPanel = React.lazy(() =>
  import('../../../../renderer/src/components/openspace/OpenSpaceRecorderPanel.js').then((m) => ({ default: m.OpenSpaceRecorderPanel }))
);

export const OPENSPACE_PANEL_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
  OpenSpacePanel: LazyOpenSpacePanel,
  OpenSpaceScriptEditor: LazyOpenSpaceScriptEditor,
  OpenSpaceDatasetTree: LazyOpenSpaceDatasetTree,
  OpenSpaceProfileManager: LazyOpenSpaceProfileManager,
  OpenSpaceRecorderPanel: LazyOpenSpaceRecorderPanel,
};

// ─── 合并面板注册表 ─────────────────────────────────────────────

export const ALL_SIDEBAR_PANELS: Record<string, SidebarPanelDef> = {
  ...FUSION_SIDEBAR_PANELS,
  ...OPENSPACE_SIDEBAR_PANELS,
};

export const ALL_PANEL_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
  ...FUSION_PANEL_COMPONENTS,
  ...OPENSPACE_PANEL_COMPONENTS,
};

// ─── SidebarPanel 类型扩展声明 ──────────────────────────────────
// 需要在 ui-store.ts 的 SidebarPanel 联合类型中追加以下 ID:
//   | 'fusion' | 'vector-memory' | 'dag-orchestrator' | 'multi-agent'
//   | 'model-router' | 'cron-schedule' | 'review-report' | 'user-profile'
//   | 'openspace' | 'openspace-script' | 'openspace-dataset'
//   | 'openspace-profile' | 'openspace-recorder'

export type FusionSidebarPanel =
  | 'fusion'
  | 'vector-memory'
  | 'dag-orchestrator'
  | 'multi-agent'
  | 'model-router'
  | 'cron-schedule'
  | 'review-report'
  | 'user-profile';

export type OpenSpaceSidebarPanel =
  | 'openspace'
  | 'openspace-script'
  | 'openspace-dataset'
  | 'openspace-profile'
  | 'openspace-recorder';

// ─── ActivityBar 图标注册辅助 ───────────────────────────────────
// 在 ActivityBar.tsx 的 sidebarIcons 数组中追加:
//   ...Object.values(ALL_SIDEBAR_PANELS).map(def => ({
//     id: def.id as SidebarPanel,
//     title: def.label,
//     icon: <span className="text-lg">{def.icon}</span>,
//   }))

export function getPanelIconEntries(): Array<{ id: string; title: string; icon: string }> {
  return Object.values(ALL_SIDEBAR_PANELS).map((def) => ({
    id: def.id,
    title: def.label,
    icon: def.icon,
  }));
}
