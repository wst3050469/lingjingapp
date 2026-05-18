import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageGateway } from '../gateway/message-gateway.js';
import type { IPlatformConnector } from '../gateway/types.js';

function makeConnector(platform: string, available: boolean = true): IPlatformConnector {
  return {
    platform,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn(),
    isAvailable: vi.fn().mockReturnValue(available),
  };
}

describe('MessageGateway', () => {
  let gateway: MessageGateway;

  beforeEach(() => {
    gateway = new MessageGateway();
  });

  describe('registerPlatform', () => {
    it('should register and connect platform', async () => {
      const connector = makeConnector('telegram');
      await gateway.registerPlatform(connector);
      expect(connector.connect).toHaveBeenCalled();
    });

    it('should handle connect failure gracefully', async () => {
      const connector = makeConnector('telegram');
      connector.connect = vi.fn().mockRejectedValue(new Error('connect failed'));
      await expect(gateway.registerPlatform(connector)).resolves.not.toThrow();
    });

    it('should set up message forwarding', async () => {
      const connector = makeConnector('slack');
      await gateway.registerPlatform(connector);
      expect(connector.onMessage).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('sendMessage', () => {
    it('should send message to registered platform', async () => {
      const connector = makeConnector('slack');
      await gateway.registerPlatform(connector);
      await gateway.sendMessage({
        platform: 'slack', sender: 'user', content: 'hi', timestamp: Date.now(), metadata: {},
      });
      expect(connector.send).toHaveBeenCalled();
    });

    it('should throw for unregistered platform', async () => {
      await expect(gateway.sendMessage({
        platform: 'unknown', sender: 'u', content: 'hi', timestamp: 0, metadata: {},
      })).rejects.toThrow('not registered');
    });

    it('should throw for unavailable platform', async () => {
      const connector = makeConnector('slack', false);
      await gateway.registerPlatform(connector);
      await expect(gateway.sendMessage({
        platform: 'slack', sender: 'u', content: 'hi', timestamp: 0, metadata: {},
      })).rejects.toThrow('not available');
    });
  });

  describe('onMessage', () => {
    it('should invoke callback on incoming messages', async () => {
      const callback = vi.fn();
      gateway.onMessage(callback);
      const connector = makeConnector('slack');
      await gateway.registerPlatform(connector);

      const onMsgHandler = (connector.onMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const testMsg = { platform: 'slack', sender: 'bot', content: 'hello', timestamp: 1, metadata: {} };
      onMsgHandler(testMsg);
      expect(callback).toHaveBeenCalledWith(testMsg);
    });
  });

  describe('getAvailablePlatforms', () => {
    it('should return empty list initially', () => {
      expect(gateway.getAvailablePlatforms()).toEqual([]);
    });

    it('should return available platforms', async () => {
      await gateway.registerPlatform(makeConnector('slack', true));
      await gateway.registerPlatform(makeConnector('discord', false));
      const platforms = gateway.getAvailablePlatforms();
      expect(platforms).toContain('slack');
      expect(platforms).not.toContain('discord');
    });
  });
});
