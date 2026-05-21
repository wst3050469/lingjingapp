import type { ActivityFeatures } from './types.js';
export declare class ActivityMonitor {
    private keystrokes;
    private fileSwitches;
    private isDebugActive;
    private breakpointCount;
    private lastEditTime;
    private recentActivities;
    private readonly maxRecentActivities;
    recordKeystroke(): void;
    recordFileSwitch(): void;
    setDebugState(active: boolean): void;
    setBreakpointCount(count: number): void;
    getFeatures(): ActivityFeatures;
    private addActivity;
    private countInWindow;
    private pruneOldEntries;
}
//# sourceMappingURL=activity-monitor.d.ts.map