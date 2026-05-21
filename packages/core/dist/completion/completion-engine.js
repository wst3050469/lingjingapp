import { DebounceTrigger } from './debounce-trigger.js';
import { ContextBuilder } from './context-builder.js';
import { SuggestionFilter } from './suggestion-filter.js';
import { PartialAcceptor } from './partial-acceptor.js';
import { CancellationController } from './cancellation-controller.js';
export class CompletionEngine {
    debounceTrigger;
    contextBuilder;
    suggestionFilter;
    partialAcceptor;
    cancellationController;
    config;
    currentSession = null;
    intentDetector;
    constructor(config, intentDetector) {
        this.config = {
            debounceMs: config?.debounceMs ?? 300,
            maxPrefixChars: config?.maxPrefixChars ?? 20000,
            maxSuffixChars: config?.maxSuffixChars ?? 10000,
            timeoutMs: config?.timeoutMs ?? 3000,
            enableMultiLine: config?.enableMultiLine ?? true,
            maxTokens: config?.maxTokens ?? 500,
        };
        this.intentDetector = intentDetector;
        this.debounceTrigger = new DebounceTrigger(this.config.debounceMs);
        this.contextBuilder = new ContextBuilder(this.config.maxPrefixChars, this.config.maxSuffixChars);
        this.suggestionFilter = new SuggestionFilter();
        this.partialAcceptor = new PartialAcceptor();
        this.cancellationController = new CancellationController();
    }
    trigger(params) {
        if (this.intentDetector && this.intentDetector.getState().currentMode !== 'coding') {
            return;
        }
        this.debounceTrigger.trigger(() => {
            this.executeCompletion(params);
        });
    }
    cancel() {
        this.debounceTrigger.cancel();
        this.cancellationController.cancel();
        this.currentSession = null;
    }
    accept() {
        return this.partialAcceptor.acceptAll() || null;
    }
    acceptWord() {
        return this.partialAcceptor.acceptNextWord();
    }
    reject() {
        this.partialAcceptor.reject();
        this.cancel();
    }
    getSession() {
        return this.currentSession;
    }
    async executeCompletion(params) {
        const signal = this.cancellationController.create();
        const request = this.contextBuilder.build({
            ...params,
            maxTokens: this.config.maxTokens,
        });
        this.currentSession = {
            id: `comp_${Date.now()}`,
            state: 'requesting',
            request,
            createdAt: new Date(),
        };
        if (signal.aborted)
            return;
        this.currentSession.state = 'streaming';
    }
    setSuggestion(result, suffixText) {
        const filtered = this.suggestionFilter.filter(result, suffixText);
        if (filtered) {
            this.partialAcceptor.setSuggestion(filtered.text);
        }
        return filtered;
    }
}
//# sourceMappingURL=completion-engine.js.map