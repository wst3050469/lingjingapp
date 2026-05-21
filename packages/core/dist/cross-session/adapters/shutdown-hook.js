import { logger } from '../../utils/logger.js';
export class ShutdownHook {
    register(shutdown, persistor, getCurrentSnapshot) {
        shutdown.registerCleanup(async () => {
            const snapshot = getCurrentSnapshot();
            if (snapshot) {
                try {
                    await persistor.save(snapshot);
                    logger.info('[CSM] 退出前完成会话持久化');
                }
                catch (error) {
                    logger.error('[CSM] 退出前持久化失败:', error instanceof Error ? error.message : String(error));
                }
            }
        });
    }
}
//# sourceMappingURL=shutdown-hook.js.map