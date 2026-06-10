import type { UnifiedMessage, IPlatformConnector, IMessageGateway } from './types.js';
export declare class MessageGateway implements IMessageGateway {
    private platforms;
    private globalCallbacks;
    registerPlatform(connector: IPlatformConnector): Promise<void>;
    sendMessage(message: UnifiedMessage): Promise<void>;
    onMessage(callback: (msg: UnifiedMessage) => void): void;
    getAvailablePlatforms(): string[];
}
//# sourceMappingURL=message-gateway.d.ts.map