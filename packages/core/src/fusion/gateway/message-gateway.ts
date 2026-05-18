import type { UnifiedMessage, IPlatformConnector, IMessageGateway } from './types.js';
import { logger } from '../../utils/logger.js';

export class MessageGateway implements IMessageGateway {
  private platforms = new Map<string, IPlatformConnector>();
  private globalCallbacks: Array<(msg: UnifiedMessage) => void> = [];

  async registerPlatform(connector: IPlatformConnector): Promise<void> {
    try {
      await connector.connect();
      this.platforms.set(connector.platform, connector);
      connector.onMessage((msg) => {
        for (const cb of this.globalCallbacks) {
          try {
            cb(msg);
          } catch (err) {
            logger.warn(`[MessageGateway] global callback error: ${(err as Error).message}`);
          }
        }
      });
      logger.info(`[MessageGateway] platform "${connector.platform}" registered`);
    } catch (err) {
      logger.warn(`[MessageGateway] platform "${connector.platform}" connect failed: ${(err as Error).message}`);
    }
  }

  async sendMessage(message: UnifiedMessage): Promise<void> {
    const connector = this.platforms.get(message.platform);
    if (!connector) {
      throw new Error(`Platform "${message.platform}" not registered`);
    }
    if (!connector.isAvailable()) {
      throw new Error(`Platform "${message.platform}" is not available`);
    }
    await connector.send(message);
  }

  onMessage(callback: (msg: UnifiedMessage) => void): void {
    this.globalCallbacks.push(callback);
  }

  getAvailablePlatforms(): string[] {
    return Array.from(this.platforms.entries())
      .filter(([, connector]) => connector.isAvailable())
      .map(([platform]) => platform);
  }
}
