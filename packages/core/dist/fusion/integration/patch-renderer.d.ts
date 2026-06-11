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
export interface SidebarPanelDef {
    id: string;
    icon: string;
    label: string;
    component: string;
}
export declare const FUSION_SIDEBAR_PANELS: Record<string, SidebarPanelDef>;
export declare const OPENSPACE_SIDEBAR_PANELS: Record<string, SidebarPanelDef>;
export declare const ALL_SIDEBAR_PANELS: Record<string, SidebarPanelDef>;
export declare const FUSION_PANEL_COMPONENTS: Record<string, any>;
export declare const OPENSPACE_PANEL_COMPONENTS: Record<string, any>;
export declare const ALL_PANEL_COMPONENTS: Record<string, any>;
export type FusionSidebarPanel = 'fusion' | 'vector-memory' | 'dag-orchestrator' | 'multi-agent' | 'model-router' | 'cron-schedule' | 'review-report' | 'user-profile';
export type OpenSpaceSidebarPanel = 'openspace' | 'openspace-script' | 'openspace-dataset' | 'openspace-profile' | 'openspace-recorder';
export declare function getPanelIconEntries(): Array<{
    id: string;
    title: string;
    icon: string;
}>;
//# sourceMappingURL=patch-renderer.d.ts.map