/**
 * Fusion & OpenSpace 懒加载组件映射（React 依赖）
 *
 * ⚠️ 此文件包含 React.lazy() 调用，仅限渲染进程导入。
 *    严禁在 Electron 主进程中导入此文件！
 *    主进程应使用 patch-renderer.ts 中的类型和静态数据。
 */

import React from 'react';

// ─── Fusion 面板组件映射（懒加载） ─────────────────────────────────

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

// ─── OpenSpace 面板组件映射（懒加载） ──────────────────────────────

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

// ─── 合并面板组件映射 ─────────────────────────────────────────────

export const ALL_PANEL_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
  ...FUSION_PANEL_COMPONENTS,
  ...OPENSPACE_PANEL_COMPONENTS,
};
