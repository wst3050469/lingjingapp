import { ActivityMonitor } from './activity-monitor.js';
import { ModeClassifier } from './mode-classifier.js';
export class IntentDetector {
    activityMonitor;
    modeClassifier;
    currentState;
    listeners = [];
    debounceTimer = null;
    debounceMs;
    constructor(debounceMs = 1000) {
        this.debounceMs = debounceMs;
        this.activityMonitor = new ActivityMonitor();
        this.modeClassifier = new ModeClassifier();
        this.currentState = {
            currentMode: 'browsing',
            confidence: 0.5,
            features: this.activityMonitor.getFeatures(),
            lastSwitchAt: new Date(),
        };
    }
    recordActivity(type) {
        switch (type) {
            case 'keypress':
                this.activityMonitor.recordKeystroke();
                break;
            case 'file-switch':
                this.activityMonitor.recordFileSwitch();
                break;
            case 'debug-start':
                this.activityMonitor.setDebugState(true);
                break;
            case 'debug-stop':
                this.activityMonitor.setDebugState(false);
                break;
        }
        this.scheduleUpdate();
    }
    getState() {
        return { ...this.currentState };
    }
    onChange(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    scheduleUpdate() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => this.updateState(), this.debounceMs);
    }
    updateState() {
        const features = this.activityMonitor.getFeatures();
        const { mode, confidence } = this.modeClassifier.classify(features);
        if (mode !== this.currentState.currentMode) {
            this.currentState = {
                currentMode: mode,
                confidence,
                features,
                lastSwitchAt: new Date(),
            };
            this.listeners.forEach(l => l(this.currentState));
        }
        else {
            this.currentState = { ...this.currentState, confidence, features };
        }
    }
}
//# sourceMappingURL=intent-detector.js.map