"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HonchoUserModeler = void 0;
const logger_js_1 = require("../../utils/logger.js");
const types_js_1 = require("./types.js");
class HonchoUserModeler {
    config;
    currentModel;
    eventBus = null;
    memoryAdapter = null;
    reflectCallback = null;
    persistTimer = null;
    healthy = true;
    unsubMemory = null;
    constructor(userId, config, eventBus, memoryAdapter) {
        this.config = { ...types_js_1.DEFAULT_USER_MODELER_CONFIG, ...config };
        this.currentModel = (0, types_js_1.createDefaultProfile)(userId);
        if (eventBus)
            this.eventBus = eventBus;
        if (memoryAdapter)
            this.memoryAdapter = memoryAdapter;
        this.startPersistInterval();
        this.subscribeMemoryEvents();
    }
    setEventBus(eventBus) {
        this.eventBus = eventBus;
        this.subscribeMemoryEvents();
    }
    setMemoryAdapter(adapter) {
        this.memoryAdapter = adapter;
    }
    setReflectCallback(callback) {
        this.reflectCallback = callback;
    }
    subscribeMemoryEvents() {
        if (!this.eventBus)
            return;
        if (this.unsubMemory) {
            this.unsubMemory();
        }
        this.unsubMemory = this.eventBus.subscribe('memory:updated', () => {
            logger_js_1.logger.info('[HonchoUserModeler] memory:updated event received, triggering incremental update');
        }, {});
    }
    startPersistInterval() {
        if (this.persistTimer)
            clearInterval(this.persistTimer);
        this.persistTimer = setInterval(() => {
            this.persist().catch((err) => {
                logger_js_1.logger.warn(`[HonchoUserModeler] persist failed: ${err.message}`);
            });
        }, this.config.persistInterval);
    }
    async persist() {
        if (!this.memoryAdapter)
            return;
        try {
            await this.memoryAdapter.write(`user_profile:${this.currentModel.id}`, this.currentModel, 'user_profiles');
        }
        catch (err) {
            logger_js_1.logger.warn(`[HonchoUserModeler] persist error: ${err.message}`);
        }
    }
    mergeArray(current, incoming) {
        const merged = [...current, ...incoming];
        return [...new Set(merged)];
    }
    mergeObject(current, incoming) {
        return { ...current, ...incoming };
    }
    decayDecisionHistory(history, incoming) {
        const maxAge = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const filtered = history.filter((entry) => {
            const entryDate = new Date(entry.date).getTime();
            return now - entryDate < maxAge;
        });
        const combined = [...filtered, ...incoming];
        const seen = new Set();
        const deduped = combined.filter((entry) => {
            const key = `${entry.decision}:${entry.reason}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        return deduped.slice(-50);
    }
    mergeIncremental(incremental) {
        const model = this.currentModel;
        if (incremental.codingStyle) {
            model.codingStyle = this.mergeArray(model.codingStyle, incremental.codingStyle);
        }
        if (incremental.techStack) {
            model.techStack = this.mergeArray(model.techStack, incremental.techStack);
        }
        if (incremental.workflowPatterns) {
            model.workflowPatterns = this.mergeArray(model.workflowPatterns, incremental.workflowPatterns);
        }
        if (incremental.modelPreferences) {
            model.modelPreferences = this.mergeObject(model.modelPreferences, incremental.modelPreferences);
        }
        if (incremental.decisionHistory) {
            model.decisionHistory = this.decayDecisionHistory(model.decisionHistory, incremental.decisionHistory);
        }
        model.lastUpdated = Date.now();
    }
    updateUserModel(incremental) {
        if (!this.config.enabled)
            return;
        this.mergeIncremental(incremental);
        this.eventBus?.publish('user_model:updated', this.currentModel, 'HonchoUserModeler');
        logger_js_1.logger.info(`[HonchoUserModeler] user model updated for ${this.currentModel.id}`);
    }
    getCurrentModel() {
        return { ...this.currentModel };
    }
    async triggerReflection() {
        if (!this.config.enabled || !this.reflectCallback)
            return;
        try {
            const incremental = await this.reflectCallback(this.currentModel);
            this.updateUserModel(incremental);
            logger_js_1.logger.info('[HonchoUserModeler] reflection completed');
        }
        catch (err) {
            logger_js_1.logger.warn(`[HonchoUserModeler] reflection failed: ${err.message}`);
        }
    }
    async loadPersistedModel() {
        if (!this.memoryAdapter)
            return;
        try {
            const stored = await this.memoryAdapter.read(`user_profile:${this.currentModel.id}`, 'user_profiles');
            if (stored) {
                const profile = stored;
                this.currentModel = { ...this.currentModel, ...profile };
                logger_js_1.logger.info(`[HonchoUserModeler] loaded persisted model for ${this.currentModel.id}`);
            }
        }
        catch (err) {
            logger_js_1.logger.warn(`[HonchoUserModeler] load persisted model failed: ${err.message}`);
        }
    }
    destroy() {
        if (this.persistTimer) {
            clearInterval(this.persistTimer);
            this.persistTimer = null;
        }
        if (this.unsubMemory) {
            this.unsubMemory();
            this.unsubMemory = null;
        }
    }
    healthCheck() {
        return { healthy: this.healthy };
    }
}
exports.HonchoUserModeler = HonchoUserModeler;
//# sourceMappingURL=honcho-user-modeler.js.map