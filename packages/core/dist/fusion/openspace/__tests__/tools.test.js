import { describe, it, expect, vi } from 'vitest';
import { createOpenSpaceExecuteTool, createOpenSpaceQueryTool, createOpenSpaceToolSet } from '../tools/index.js';
describe('OpenSpace tools', () => {
    function createMockBridge(connected = true) {
        return {
            isConnected: connected,
            sendScript: vi.fn().mockResolvedValue({ success: true, result: 'done', duration: 100 }),
            getSceneContext: vi.fn().mockResolvedValue({
                currentCamera: { position: [0, 0, 0] },
                activePlanets: ['Earth'],
                time: '2025-01-01T00:00:00Z',
            }),
        };
    }
    function createMockProcessManager() {
        return {
            runState: 'running',
            health: { healthy: true, pid: 1234, memoryUsage: 500 * 1024 * 1024, uptime: 3600 },
            installation: { found: true, path: '/usr/local/openspace', version: '2024.1', compatible: true },
            getWebSocketPort: vi.fn(() => 4680),
        };
    }
    describe('createOpenSpaceExecuteTool', () => {
        it('should create a tool with correct metadata', () => {
            const bridge = createMockBridge();
            const tool = createOpenSpaceExecuteTool(bridge);
            expect(tool.name).toBe('openspace_execute');
            expect(tool.description).toContain('OpenSpace');
            expect(tool.parameters).toBeDefined();
            expect(tool.parameters.required).toContain('script');
        });
        it('should execute a script successfully', async () => {
            const bridge = createMockBridge();
            const tool = createOpenSpaceExecuteTool(bridge);
            const result = await tool.execute({ script: 'openspace.setPropertyValue("test", true)' }, {});
            expect(result.isError).toBeFalsy();
            expect(bridge.sendScript).toHaveBeenCalledWith({
                script: 'openspace.setPropertyValue("test", true)',
                language: 'lua',
                timeout: 30000,
            });
        });
        it('should return error when bridge is not connected', async () => {
            const bridge = createMockBridge(false);
            const tool = createOpenSpaceExecuteTool(bridge);
            const result = await tool.execute({ script: 'anything' }, {});
            expect(result.isError).toBe(true);
            expect(result.content).toContain('not connected');
            expect(bridge.sendScript).not.toHaveBeenCalled();
        });
        it('should handle script execution failure', async () => {
            const bridge = createMockBridge();
            bridge.sendScript.mockResolvedValue({
                success: false,
                error: 'Syntax error at line 1',
            });
            const tool = createOpenSpaceExecuteTool(bridge);
            const result = await tool.execute({ script: 'bad syntax' }, {});
            expect(result.isError).toBe(true);
            expect(result.content).toContain('Syntax error');
        });
        it('should handle bridge exception', async () => {
            const bridge = createMockBridge();
            bridge.sendScript.mockRejectedValue(new Error('Connection lost'));
            const tool = createOpenSpaceExecuteTool(bridge);
            const result = await tool.execute({ script: 'test' }, {});
            expect(result.isError).toBe(true);
            expect(result.content).toContain('Connection lost');
        });
        it('should accept custom language and timeout', async () => {
            const bridge = createMockBridge();
            const tool = createOpenSpaceExecuteTool(bridge);
            await tool.execute({ script: 'print("hello")', language: 'python', timeout: 5000 }, {});
            expect(bridge.sendScript).toHaveBeenCalledWith({
                script: 'print("hello")',
                language: 'python',
                timeout: 5000,
            });
        });
    });
    describe('createOpenSpaceQueryTool', () => {
        it('should create a query tool with correct name', () => {
            const bridge = createMockBridge();
            const pm = createMockProcessManager();
            const tool = createOpenSpaceQueryTool(bridge, pm);
            expect(tool.name).toBe('openspace_query');
            expect(tool.parameters).toBeDefined();
        });
        it('should return health info', async () => {
            const bridge = createMockBridge();
            const pm = createMockProcessManager();
            const tool = createOpenSpaceQueryTool(bridge, pm);
            const result = await tool.execute({ action: 'health' }, {});
            const data = JSON.parse(result.content);
            expect(data.state).toBe('running');
            expect(data.installed).toBe(true);
            expect(data.installationPath).toBe('/usr/local/openspace');
            expect(data.version).toBe('2024.1');
            expect(data.healthy).toBe(true);
            expect(data.wsPort).toBe(4680);
        });
        it('should return scene context when bridge connected', async () => {
            const bridge = createMockBridge(true);
            const pm = createMockProcessManager();
            const tool = createOpenSpaceQueryTool(bridge, pm);
            const result = await tool.execute({ action: 'scene' }, {});
            const data = JSON.parse(result.content);
            expect(data.currentCamera).toBeDefined();
            expect(data.activePlanets).toContain('Earth');
        });
        it('should return error for scene query when not connected', async () => {
            const bridge = createMockBridge(false);
            const pm = createMockProcessManager();
            const tool = createOpenSpaceQueryTool(bridge, pm);
            const result = await tool.execute({ action: 'scene' }, {});
            expect(result.isError).toBe(true);
            expect(result.content).toContain('not connected');
        });
        it('should handle scene query exception', async () => {
            const bridge = createMockBridge(true);
            bridge.getSceneContext.mockRejectedValue(new Error('Bridge timeout'));
            const pm = createMockProcessManager();
            const tool = createOpenSpaceQueryTool(bridge, pm);
            const result = await tool.execute({ action: 'scene' }, {});
            expect(result.isError).toBe(true);
            expect(result.content).toContain('Bridge timeout');
        });
        it('should default to scene action', async () => {
            const bridge = createMockBridge(true);
            const pm = createMockProcessManager();
            const tool = createOpenSpaceQueryTool(bridge, pm);
            const result = await tool.execute({}, {});
            const data = JSON.parse(result.content);
            expect(data.activePlanets).toBeDefined();
        });
    });
    describe('createOpenSpaceToolSet', () => {
        it('should return both tools', () => {
            const bridge = createMockBridge();
            const pm = createMockProcessManager();
            const toolSet = createOpenSpaceToolSet(bridge, pm);
            expect(toolSet.openspace_execute).toBeDefined();
            expect(toolSet.openspace_execute.name).toBe('openspace_execute');
            expect(toolSet.openspace_query).toBeDefined();
            expect(toolSet.openspace_query.name).toBe('openspace_query');
        });
        it('should create independent tool instances', () => {
            const bridge = createMockBridge();
            const pm = createMockProcessManager();
            const toolSet = createOpenSpaceToolSet(bridge, pm);
            expect(toolSet.openspace_execute).not.toBe(toolSet.openspace_query);
        });
    });
});
//# sourceMappingURL=tools.test.js.map