export class LoopDetector {
    history = new Map();
    maxRepeats;
    constructor(maxRepeats = 3) {
        this.maxRepeats = maxRepeats;
    }
    check(step) {
        const signature = `${step.toolName}:${JSON.stringify(step.toolArgs)}`;
        const count = (this.history.get(signature) ?? 0) + 1;
        this.history.set(signature, count);
        if (count >= this.maxRepeats) {
            return {
                stepIndex: 0,
                repeatCount: count,
                operationSignature: signature,
            };
        }
        return null;
    }
    reset() {
        this.history.clear();
    }
}
//# sourceMappingURL=loop-detector.js.map