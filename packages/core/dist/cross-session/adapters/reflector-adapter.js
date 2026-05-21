export class ReflectorAdapter {
    pendingResult = null;
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    onReflect(memories) {
        try {
            const result = this.reflector.reflect(memories);
            if (result !== null && result !== undefined) {
                const snapshot = {
                    insights: result.insights ?? [],
                    patterns: result.patterns ?? [],
                    preferences: result.preferences ?? [],
                    generatedAt: Date.now(),
                };
                this.pendingResult = snapshot;
            }
        }
        catch {
            // Ignore reflector errors
        }
    }
    consumeReflectorResult() {
        const result = this.pendingResult;
        this.pendingResult = null;
        return result;
    }
}
//# sourceMappingURL=reflector-adapter.js.map