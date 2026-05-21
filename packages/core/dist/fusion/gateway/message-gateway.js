import { logger } from '../../utils/logger.js';
export class MessageGateway {
    platforms = new Map();
    globalCallbacks = [];
    async registerPlatform(connector) {
        try {
            await connector.connect();
            this.platforms.set(connector.platform, connector);
            connector.onMessage((msg) => {
                for (const cb of this.globalCallbacks) {
                    try {
                        cb(msg);
                    }
                    catch (err) {
                        logger.warn(`[MessageGateway] global callback error: ${err.message}`);
                    }
                }
            });
            logger.info(`[MessageGateway] platform "${connector.platform}" registered`);
        }
        catch (err) {
            logger.warn(`[MessageGateway] platform "${connector.platform}" connect failed: ${err.message}`);
        }
    }
    async sendMessage(message) {
        const connector = this.platforms.get(message.platform);
        if (!connector) {
            throw new Error(`Platform "${message.platform}" not registered`);
        }
        if (!connector.isAvailable()) {
            throw new Error(`Platform "${message.platform}" is not available`);
        }
        await connector.send(message);
    }
    onMessage(callback) {
        this.globalCallbacks.push(callback);
    }
    getAvailablePlatforms() {
        return Array.from(this.platforms.entries())
            .filter(([, connector]) => connector.isAvailable())
            .map(([platform]) => platform);
    }
}
//# sourceMappingURL=message-gateway.js.map