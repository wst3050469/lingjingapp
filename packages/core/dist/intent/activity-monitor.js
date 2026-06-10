export class ActivityMonitor {
    keystrokes = [];
    fileSwitches = [];
    isDebugActive = false;
    breakpointCount = 0;
    lastEditTime = Date.now();
    recentActivities = [];
    maxRecentActivities = 20;
    recordKeystroke() {
        this.keystrokes.push(Date.now());
        this.lastEditTime = Date.now();
        this.addActivity('keypress');
        this.pruneOldEntries();
    }
    recordFileSwitch() {
        this.fileSwitches.push(Date.now());
        this.addActivity('file-switch');
        this.pruneOldEntries();
    }
    setDebugState(active) {
        this.isDebugActive = active;
        this.addActivity(active ? 'debug-start' : 'debug-stop');
    }
    setBreakpointCount(count) {
        this.breakpointCount = count;
    }
    getFeatures() {
        const now = Date.now();
        const keystrokesPerSec = this.countInWindow(this.keystrokes, now - 10000) / 10;
        const fileSwitchesPerMin = this.countInWindow(this.fileSwitches, now - 30000) * 2;
        return {
            keystrokesPerSec,
            fileSwitchesPerMin,
            isDebugActive: this.isDebugActive,
            breakpointCount: this.breakpointCount,
            timeSinceLastEdit: (now - this.lastEditTime) / 1000,
            recentActivityTypes: [...this.recentActivities],
        };
    }
    addActivity(type) {
        this.recentActivities.push(type);
        if (this.recentActivities.length > this.maxRecentActivities) {
            this.recentActivities.shift();
        }
    }
    countInWindow(timestamps, windowStart) {
        return timestamps.filter(t => t >= windowStart).length;
    }
    pruneOldEntries() {
        const cutoff = Date.now() - 60000;
        this.keystrokes = this.keystrokes.filter(t => t >= cutoff);
        this.fileSwitches = this.fileSwitches.filter(t => t >= cutoff);
    }
}
//# sourceMappingURL=activity-monitor.js.map