/**
 * Fusion & OpenSpace Renderer UI 路由注册补丁 — 类型 & 静态数据（无 React 依赖）
 *
 * ⚠️ 此文件被 Electron 主进程间接加载（通过 @codepilot/core/fusion → integration/index）。
 *    严禁在此文件顶层导入 React 或任何仅在渲染进程中可用的包！
 *
 * 集成说明：
 * 1. ActivityBar.tsx → 在 sidebarIcons 数组中追加 Fusion/OpenSpace 图标按钮
 * 2. SidebarContainer.tsx → 在条件渲染中追加面板路由 (activeSidebarPanel === 'xxx' && <Component/>)
 * 3. ui-store.ts → 扩展 SidebarPanel 联合类型，添加 Fusion/OpenSpace 面板 ID
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface SidebarPanelDef {
  id: string;
  icon: string;
  label: string;
  component: string;
}

// ─── Fusion 侧栏面板注册 ────────────────────────────────────────

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

// ─── 合并面板注册表 ─────────────────────────────────────────────

export const ALL_SIDEBAR_PANELS: Record<string, SidebarPanelDef> = {
  ...FUSION_SIDEBAR_PANELS,
  ...OPENSPACE_SIDEBAR_PANELS,
};

// ─── Fusion Panel Components (React 懒加载占位 — Electron 主进程不可用) ──

// 这些组件仅在渲染进程中被使用，在 Electron 主进程/Node.js 上下文中为空对象
// 实际 React 懒加载实现在 patch-renderer.tsx 中
const _NoopComponent = {} as any;

export const FUSION_PANEL_COMPONENTS: Record<string, any> = {
  FusionSettings: _NoopComponent,
  VectorMemoryPanel: _NoopComponent,
  DAGCanvas: _NoopComponent,
  MultiAgentPanel: _NoopComponent,
  ModelRouterConfig: _NoopComponent,
  CronScheduleManager: _NoopComponent,
  ReviewReportPanel: _NoopComponent,
  UserProfilePanel: _NoopComponent,
};

export const OPENSPACE_PANEL_COMPONENTS: Record<string, any> = {
  OpenSpacePanel: _NoopComponent,
  OpenSpaceScriptEditor: _NoopComponent,
  OpenSpaceDatasetTree: _NoopComponent,
  OpenSpaceProfileManager: _NoopComponent,
  OpenSpaceRecorderPanel: _NoopComponent,
};

export const ALL_PANEL_COMPONENTS: Record<string, any> = {
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
