export interface UnifiedMessage {
  platform: string;
  sender: string;
  content: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface IPlatformConnector {
  platform: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: UnifiedMessage): Promise<void>;
  onMessage(callback: (msg: UnifiedMessage) => void): void;
  isAvailable(): boolean;
}

export interface IMessageGateway {
  registerPlatform(connector: IPlatformConnector): void;
  sendMessage(message: UnifiedMessage): Promise<void>;
  onMessage(callback: (msg: UnifiedMessage) => void): void;
  getAvailablePlatforms(): string[];
}
