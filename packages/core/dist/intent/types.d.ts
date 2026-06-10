export type IntentMode = 'coding' | 'browsing' | 'debugging';
export type ActivityType = 'keypress' | 'file-switch' | 'debug-start' | 'debug-stop' | 'scroll' | 'selection';
export interface ActivityFeatures {
    keystrokesPerSec: number;
    fileSwitchesPerMin: number;
    isDebugActive: boolean;
    breakpointCount: number;
    timeSinceLastEdit: number;
    recentActivityTypes: ActivityType[];
}
export interface IntentState {
    currentMode: IntentMode;
    confidence: number;
    features: ActivityFeatures;
    lastSwitchAt: Date;
}
//# sourceMappingURL=types.d.ts.map