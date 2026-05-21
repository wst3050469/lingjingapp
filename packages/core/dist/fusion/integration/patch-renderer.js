import React from 'react';
export const FUSION_SIDEBAR_PANELS = {
    fusion: { id: 'fusion', icon: '\u26A1', label: '\u878D\u5408\u589E\u5F3A', component: 'FusionSettings' },
    vectorMemory: { id: 'vector-memory', icon: '\uD83E\uDDE0', label: '\u5411\u91CF\u8BB0\u5FC6', component: 'VectorMemoryPanel' },
    dag: { id: 'dag-orchestrator', icon: '\uD83D\uDD00', label: 'DAG\u7F16\u6392', component: 'DAGCanvas' },
    multiAgent: { id: 'multi-agent', icon: '\uD83D\uDC65', label: '\u591AAgent', component: 'MultiAgentPanel' },
    modelRouter: { id: 'model-router', icon: '\uD83E\uDDED', label: '\u6A21\u578B\u8DEF\u7531', component: 'ModelRouterConfig' },
    cronSchedule: { id: 'cron-schedule', icon: '\u23F0', label: 'Cron\u8C03\u5EA6', component: 'CronScheduleManager' },
    reviewReport: { id: 'review-report', icon: '\uD83D\uDD0D', label: '\u5BA1\u67E5\u62A5\u544A', component: 'ReviewReportPanel' },
    userProfile: { id: 'user-profile', icon: '\uD83D\uDC64', label: '\u7528\u6237\u753B\u50CF', component: 'UserProfilePanel' },
};
export const OPENSPACE_SIDEBAR_PANELS = {
    openspace: { id: 'openspace', icon: '\uD83C\uDF0C', label: 'OpenSpace', component: 'OpenSpacePanel' },
    openspaceScript: { id: 'openspace-script', icon: '\uD83D\uDCDD', label: 'OS\u811A\u672C', component: 'OpenSpaceScriptEditor' },
    openspaceDataset: { id: 'openspace-dataset', icon: '\uD83D\uDCC1', label: 'OS\u6570\u636E\u96C6', component: 'OpenSpaceDatasetTree' },
    openspaceProfile: { id: 'openspace-profile', icon: '\uD83C\uDFAF', label: 'OS\u573A\u666F', component: 'OpenSpaceProfileManager' },
    openspaceRecorder: { id: 'openspace-recorder', icon: '\uD83C\uDFAC', label: 'OS\u5F55\u5236', component: 'OpenSpaceRecorderPanel' },
};
const LazyFusionSettings = React.lazy(() => import('../../../../renderer/src/components/fusion/FusionSettings.js').then((m) => ({ default: m.FusionSettings })));
const LazyVectorMemoryPanel = React.lazy(() => import('../../../../renderer/src/components/fusion/VectorMemoryPanel.js').then((m) => ({ default: m.VectorMemoryPanel })));
const LazyDAGCanvas = React.lazy(() => import('../../../../renderer/src/components/fusion/DAGCanvas.js').then((m) => ({ default: m.DAGCanvas })));
const LazyMultiAgentPanel = React.lazy(() => import('../../../../renderer/src/components/fusion/MultiAgentPanel.js').then((m) => ({ default: m.MultiAgentPanel })));
const LazyModelRouterConfig = React.lazy(() => import('../../../../renderer/src/components/fusion/ModelRouterConfig.js').then((m) => ({ default: m.ModelRouterConfig })));
const LazyCronScheduleManager = React.lazy(() => import('../../../../renderer/src/components/fusion/CronScheduleManager.js').then((m) => ({ default: m.CronScheduleManager })));
const LazyReviewReportPanel = React.lazy(() => import('../../../../renderer/src/components/fusion/ReviewReportPanel.js').then((m) => ({ default: m.ReviewReportPanel })));
const LazyUserProfilePanel = React.lazy(() => import('../../../../renderer/src/components/fusion/UserProfilePanel.js').then((m) => ({ default: m.UserProfilePanel })));
export const FUSION_PANEL_COMPONENTS = {
    FusionSettings: LazyFusionSettings,
    VectorMemoryPanel: LazyVectorMemoryPanel,
    DAGCanvas: LazyDAGCanvas,
    MultiAgentPanel: LazyMultiAgentPanel,
    ModelRouterConfig: LazyModelRouterConfig,
    CronScheduleManager: LazyCronScheduleManager,
    ReviewReportPanel: LazyReviewReportPanel,
    UserProfilePanel: LazyUserProfilePanel,
};
const LazyOpenSpacePanel = React.lazy(() => import('../../../../renderer/src/components/openspace/OpenSpacePanel.js').then((m) => ({ default: m.OpenSpacePanel })));
const LazyOpenSpaceScriptEditor = React.lazy(() => import('../../../../renderer/src/components/openspace/OpenSpaceScriptEditor.js').then((m) => ({ default: m.OpenSpaceScriptEditor })));
const LazyOpenSpaceDatasetTree = React.lazy(() => import('../../../../renderer/src/components/openspace/OpenSpaceDatasetTree.js').then((m) => ({ default: m.OpenSpaceDatasetTree })));
const LazyOpenSpaceProfileManager = React.lazy(() => import('../../../../renderer/src/components/openspace/OpenSpaceProfileManager.js').then((m) => ({ default: m.OpenSpaceProfileManager })));
const LazyOpenSpaceRecorderPanel = React.lazy(() => import('../../../../renderer/src/components/openspace/OpenSpaceRecorderPanel.js').then((m) => ({ default: m.OpenSpaceRecorderPanel })));
export const OPENSPACE_PANEL_COMPONENTS = {
    OpenSpacePanel: LazyOpenSpacePanel,
    OpenSpaceScriptEditor: LazyOpenSpaceScriptEditor,
    OpenSpaceDatasetTree: LazyOpenSpaceDatasetTree,
    OpenSpaceProfileManager: LazyOpenSpaceProfileManager,
    OpenSpaceRecorderPanel: LazyOpenSpaceRecorderPanel,
};
export const ALL_SIDEBAR_PANELS = {
    ...FUSION_SIDEBAR_PANELS,
    ...OPENSPACE_SIDEBAR_PANELS,
};
export const ALL_PANEL_COMPONENTS = {
    ...FUSION_PANEL_COMPONENTS,
    ...OPENSPACE_PANEL_COMPONENTS,
};
export function getPanelIconEntries() {
    return Object.values(ALL_SIDEBAR_PANELS).map((def) => ({
        id: def.id,
        title: def.label,
        icon: def.icon,
    }));
}
