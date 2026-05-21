export class ModeClassifier {
    classify(features) {
        if (features.isDebugActive || features.breakpointCount > 0) {
            return { mode: 'debugging', confidence: 0.9 };
        }
        if (features.keystrokesPerSec > 2 && features.timeSinceLastEdit < 2) {
            return { mode: 'coding', confidence: Math.min(features.keystrokesPerSec / 5, 1) * 0.8 + 0.2 };
        }
        if (features.fileSwitchesPerMin > 4 && features.keystrokesPerSec < 1) {
            return { mode: 'browsing', confidence: 0.7 };
        }
        if (features.timeSinceLastEdit < 5) {
            return { mode: 'coding', confidence: 0.6 };
        }
        return { mode: 'browsing', confidence: 0.5 };
    }
}
//# sourceMappingURL=mode-classifier.js.map