export const DEFAULT_CONTEXT_BUDGET = {
    systemLayerRatio: 0.2,
    workingLayerRatio: 0.5,
    historyLayerRatio: 0.3,
    compactionTriggerRatio: 0.7,
    maxContextTokens: 200000,
    workingWindowSize: 20,
};
export class ContextCompressor {
    budget;
    constructor(budget = {}) {
        this.budget = { ...DEFAULT_CONTEXT_BUDGET, ...budget };
    }
    shouldCompress(totalTokens) {
        return totalTokens >= this.budget.maxContextTokens * this.budget.compactionTriggerRatio;
    }
    separateLayers(messages) {
        const system = [];
        const working = [];
        const history = [];
        const workingStart = Math.max(0, messages.length - this.budget.workingWindowSize);
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (msg.role === 'user' && typeof msg.content === 'string' && i === 0) {
                system.push(msg);
            }
            else if (i >= workingStart) {
                working.push(msg);
            }
            else {
                history.push(msg);
            }
        }
        return { system, working, history };
    }
    calculateBudgets() {
        const total = this.budget.maxContextTokens;
        return {
            system: Math.floor(total * this.budget.systemLayerRatio),
            working: Math.floor(total * this.budget.workingLayerRatio),
            history: Math.floor(total * this.budget.historyLayerRatio),
            total,
        };
    }
    compress(messages, estimateTokens) {
        const totalTokens = estimateTokens(messages);
        if (!this.shouldCompress(totalTokens)) {
            return messages;
        }
        const layers = this.separateLayers(messages);
        const budgets = this.calculateBudgets();
        const workingTokens = estimateTokens(layers.working);
        const historyBudget = budgets.total - budgets.system - workingTokens;
        if (historyBudget > 0 && layers.history.length > 0) {
            let kept = [];
            let tokens = 0;
            for (let i = layers.history.length - 1; i >= 0; i--) {
                const msgTokens = estimateTokens([layers.history[i]]);
                if (tokens + msgTokens > historyBudget)
                    break;
                kept.unshift(layers.history[i]);
                tokens += msgTokens;
            }
            return [...layers.system, ...kept, ...layers.working];
        }
        return [...layers.system, ...layers.working];
    }
    getBudget() {
        return { ...this.budget };
    }
    updateBudget(updates) {
        this.budget = { ...this.budget, ...updates };
    }
}
//# sourceMappingURL=context-compressor.js.map