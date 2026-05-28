"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMemoryLinkages = setupMemoryLinkages;
const logger_js_1 = require("../../utils/logger.js");
function setupMemoryLinkages(eventBus, deps) {
    const unsubscribes = [];
    const { vectorStore, userModeler } = deps;
    const unsubMemorySync = eventBus.subscribe('memory:updated', async (event) => {
        try {
            const data = event.data;
            if (data.entries && Array.isArray(data.entries)) {
                await vectorStore.syncFromMemory(data.entries);
            }
            else if (data.id && data.content && data.category) {
                await vectorStore.syncFromMemory([
                    { id: data.id, content: data.content, category: data.category },
                ]);
            }
            eventBus.publish('vector:synced', { source: 'memory:updated', timestamp: Date.now() }, 'patch-memory');
        }
        catch (err) {
            logger_js_1.logger.warn(`[Fusion:Memory] vector sync failed: ${err.message}`);
        }
    });
    unsubscribes.push(unsubMemorySync);
    logger_js_1.logger.info('[Fusion:Memory] memory:updated → VectorMemoryStore.syncFromMemory linked');
    const unsubUserModel = eventBus.subscribe('memory:updated', async (event) => {
        try {
            const data = event.data;
            if (data.category === 'user_preference' || data.category === 'workflow_pattern') {
                const incremental = {};
                if (data.category === 'user_preference') {
                    incremental.modelPreferences = { [data.category]: data.content ?? '' };
                }
                if (data.category === 'workflow_pattern') {
                    incremental.workflowPatterns = data.content ? [data.content] : [];
                }
                userModeler.updateUserModel(incremental);
            }
            eventBus.publish('user_model:updated', { source: 'memory:updated', timestamp: Date.now() }, 'patch-memory');
        }
        catch (err) {
            logger_js_1.logger.warn(`[Fusion:Memory] user model update failed: ${err.message}`);
        }
    });
    unsubscribes.push(unsubUserModel);
    logger_js_1.logger.info('[Fusion:Memory] memory:updated → HonchoUserModeler.updateUserModel linked');
    const unsubMessageEnd = eventBus.subscribe('agent:message_end', (_event) => {
        logger_js_1.logger.debug('[Fusion:Memory] agent:message_end received; MemoryNudger handles its own triggers');
    });
    unsubscribes.push(unsubMessageEnd);
    logger_js_1.logger.info('[Fusion:Memory] agent:message_end → MemoryNudger (self-managed) linked');
    const unsubReflector = eventBus.subscribe('user_model:updated', async (event) => {
        try {
            const data = event.data;
            if (data && Object.keys(data).length > 0) {
                userModeler.updateUserModel(data);
                logger_js_1.logger.debug('[Fusion:Memory] Reflector output → user model updated');
            }
        }
        catch (err) {
            logger_js_1.logger.warn(`[Fusion:Memory] reflector → user model update failed: ${err.message}`);
        }
    });
    unsubscribes.push(unsubReflector);
    logger_js_1.logger.info('[Fusion:Memory] MemoryReflector output → HonchoUserModeler.updateUserModel linked');
    return {
        unsubscribes,
        destroy() {
            for (const unsub of unsubscribes) {
                unsub();
            }
            unsubscribes.length = 0;
            logger_js_1.logger.info('[Fusion:Memory] All memory linkages unsubscribed');
        },
    };
}
//# sourceMappingURL=patch-memory.js.map