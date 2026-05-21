import { logger } from '../../utils/logger.js';
export class NudgerAdapter {
    snapshotter;
    persistor;
    nudger;
    constructor(nudger, snapshotter, persistor) {
        this.nudger = nudger;
        this.snapshotter = snapshotter;
        this.persistor = persistor;
    }
    onNudge(conversation, baseSnapshot) {
        try {
            const result = this.nudger.review(conversation);
            if (result !== null && result !== undefined) {
                const incremental = this.snapshotter.computeDelta(conversation, baseSnapshot);
                if (incremental) {
                    this.persistor.save(incremental).catch((err) => {
                        logger.error('NudgerAdapter: incremental persist failed:', err instanceof Error ? err.message : String(err));
                    });
                }
            }
        }
        catch (error) {
            logger.error('NudgerAdapter: onNudge error:', error instanceof Error ? error.message : String(error));
        }
    }
}
//# sourceMappingURL=nudger-adapter.js.map