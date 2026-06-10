export class HumanConfirmationGate {
    pendingConfirmations = new Map();
    async requireConfirmation(step) {
        if (!step.isHighRisk)
            return true;
        return new Promise((resolve) => {
            this.pendingConfirmations.set(step.id, { step, resolve });
        });
    }
    confirm(stepId) {
        const pending = this.pendingConfirmations.get(stepId);
        if (pending) {
            pending.resolve(true);
            this.pendingConfirmations.delete(stepId);
        }
    }
    reject(stepId) {
        const pending = this.pendingConfirmations.get(stepId);
        if (pending) {
            pending.resolve(false);
            this.pendingConfirmations.delete(stepId);
        }
    }
    getPendingSteps() {
        return Array.from(this.pendingConfirmations.values()).map(p => p.step);
    }
}
//# sourceMappingURL=human-confirmation-gate.js.map