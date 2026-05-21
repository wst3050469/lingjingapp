import React from 'react';
export interface SidebarPanelDef {
    id: string;
    icon: string;
    label: string;
    component: string;
}
export declare const FUSION_SIDEBAR_PANELS: Record<string, SidebarPanelDef>;
export declare const OPENSPACE_SIDEBAR_PANELS: Record<string, SidebarPanelDef>;
export declare const FUSION_PANEL_COMPONENTS: Record<string, React.LazyExoticComponent<any>>;
export declare const OPENSPACE_PANEL_COMPONENTS: Record<string, React.LazyExoticComponent<any>>;
export declare const ALL_SIDEBAR_PANELS: Record<string, SidebarPanelDef>;
export declare const ALL_PANEL_COMPONENTS: Record<string, React.LazyExoticComponent<any>>;
export declare function getPanelIconEntries(): Array<{ id: string; title: string; icon: string }>;
export declare type FusionSidebarPanel = 'fusion' | 'vector-memory' | 'dag-orchestrator' | 'multi-agent' | 'model-router' | 'cron-schedule' | 'review-report' | 'user-profile';
export declare type OpenSpaceSidebarPanel = 'openspace' | 'openspace-script' | 'openspace-dataset' | 'openspace-profile' | 'openspace-recorder';
