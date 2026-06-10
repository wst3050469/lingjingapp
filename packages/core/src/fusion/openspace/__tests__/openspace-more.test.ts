import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenSpaceBridge } from '../bridge.js';
import { OpenSpaceProfileManager } from '../profile-manager.js';
import { OpenSpaceScriptGenerator } from '../script-generator.js';
import type { IWebSocket, IWebSocketFactory } from '../bridge.js';
import type { IFileSystem } from '../profile-manager.js';
import type { LLMClient } from '../script-generator.js';

// ─── Bridge Tests ───

describe('OpenSpaceBridge', () => {
  function createMockWebSocket(): IWebSocket & { triggerOpen: () => void; triggerMessage: (data: string) => void; triggerClose: () => void; sentData: string[] } {
    const handlers: Record<string, Function[]> = {};
    const sentData: string[] = [];
    const ws: any = {
      readyState: 3,
      sentData,
      on(event: string, listener: (...args: unknown[]) => void) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(listener);
        return ws;
      },
      send: (data: string) => { sentData.push(data); },
      close: vi.fn(),
      triggerOpen() { ws.readyState = 1; (handlers['open'] || []).forEach((fn: any) => fn()); },
      triggerMessage(data: string) { (handlers['message'] || []).forEach((fn: any) => fn(data)); },
      triggerClose() { ws.readyState = 3; (handlers['close'] || []).forEach((fn: any) => fn()); },
    };
    return ws;
  }

  let mockWs: ReturnType<typeof createMockWebSocket>;
  let wsFactory: IWebSocketFactory;
  let bridge: OpenSpaceBridge;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    wsFactory = (url: string) => {
      mockWs._url = url;
      return mockWs;
    };
    bridge = new OpenSpaceBridge(
      { connectTimeout: 5000, commandTimeout: 10000 },
      undefined,
      wsFactory,
    );
  });

  it('should start disconnected', () => {
    expect(bridge.isConnected).toBe(false);
  });

  it('should connect and set isConnected', async () => {
    const connectPromise = bridge.connect();
    expect(mockWs._url).toContain('4680');
    mockWs.triggerOpen();
    await connectPromise;
    expect(bridge.isConnected).toBe(true);
  });

  it('should handle connection timeout', async () => {
    bridge = new OpenSpaceBridge({ connectTimeout: 50 }, undefined, wsFactory);
    await expect(bridge.connect()).rejects.toThrow('timeout');
    expect(bridge.isConnected).toBe(false);
  });

  it('should disconnect', async () => {
    const connectPromise = bridge.connect();
    mockWs.triggerOpen();
    await connectPromise;
    expect(bridge.isConnected).toBe(true);

    bridge.disconnect();
    expect(bridge.isConnected).toBe(false);
  });

  it('should send script and return result', async () => {
    const connectPromise = bridge.connect();
    mockWs.triggerOpen();
    await connectPromise;

    const execPromise = bridge.sendScript({ script: 'test()', language: 'lua' });
    
    // The bridge sends JSON: { jsonrpc: "2.0", id: 1, method: "...", params: {...} }
    const sent = JSON.parse(mockWs.sentData[0]);
    expect(sent.id).toBe(1);
    expect(sent.method).toContain('script');
    
    // Respond with matching id and result
    mockWs.triggerMessage(JSON.stringify({ jsonrpc: '2.0', id: sent.id, result: 'done' }));

    const result = await execPromise;
    expect(result.success).toBe(true);
    expect(result.result).toBe('done');
  });

  it('should return error when not connected', async () => {
    const result = await bridge.sendScript({ script: 'test', language: 'lua' });
    expect(result.success).toBe(false);
  });
});

// ─── Profile Manager Tests ───

describe('OpenSpaceProfileManager', () => {
  it('should have preset profiles', () => {
    const pm = new OpenSpaceProfileManager();
    const profiles = pm.presetProfiles;
    expect(profiles.length).toBeGreaterThanOrEqual(3);
    expect(profiles.some((p: any) => p.name === 'solar_system')).toBe(true);
  });

  it('should list profiles including presets and custom', async () => {
    const mockFs: IFileSystem = {
      readdir: vi.fn().mockResolvedValue(['my_scene.json']),
      readFile: vi.fn().mockResolvedValue(JSON.stringify({ name: 'my_scene', script: 'test' })),
      writeFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      mkdir: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({ isDirectory: () => false }),
    };
    const pm = new OpenSpaceProfileManager(mockFs);
    const profiles = await pm.listProfiles('/data');
    // Should have preset + any custom profiles found
    expect(profiles.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle filesystem errors gracefully', async () => {
    const mockFs: IFileSystem = {
      readdir: vi.fn().mockRejectedValue(new Error('Permission denied')),
      readFile: vi.fn().mockRejectedValue(new Error('')),
      writeFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      mkdir: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({ isDirectory: () => false }),
    };
    const pm = new OpenSpaceProfileManager(mockFs);
    const profiles = await pm.listProfiles('/data');
    // Should at least have preset profiles
    expect(profiles.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Script Generator Tests ───

describe('OpenSpaceScriptGenerator', () => {
  it('should generate from template for known patterns', async () => {
    const generator = new OpenSpaceScriptGenerator();
    const result = await generator.generate('navigate to Mars');
    expect(result.source).toBe('template');
    expect(result.script).toContain('Mars');
    expect(result.script).toContain('NavigationHandler');
    expect(result.reviewResult).toBeDefined();
    expect(result.reviewResult.passed).toBe(true);
  });

  it('should use LLM for unknown patterns when client available', async () => {
    const mockLLM: LLMClient = {
      generate: vi.fn().mockResolvedValue('openspace.setPropertyValue("test", true)'),
    };
    const generator = new OpenSpaceScriptGenerator(mockLLM);
    const result = await generator.generate('do something complex');
    expect(result.source).toBe('llm');
    expect(mockLLM.generate).toHaveBeenCalled();
  });

  it('should return error when LLM fails', async () => {
    const mockLLM: LLMClient = {
      generate: vi.fn().mockRejectedValue(new Error('API error')),
    };
    const generator = new OpenSpaceScriptGenerator(mockLLM);
    const result = await generator.generate('custom command');
    expect(result.error).toBeDefined();
  });

  it('should return template match for "navigate to Mars"', async () => {
    const generator = new OpenSpaceScriptGenerator();
    const result = await generator.generate('navigate to Mars');
    expect(result.script).toContain('setPropertyValue');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
