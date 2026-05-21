import { describe, it, expect, vi } from 'vitest';
import { OpenSpaceProcessManager } from '../process-manager.js';
describe('OpenSpace process-manager', () => {
    // --- compareVersions (private, tested via finalizeDetection) ---
    describe('state management', () => {
        it('should start in stopped state', () => {
            const pm = new OpenSpaceProcessManager();
            expect(pm.runState).toBe('stopped');
        });
        it('should have null installation initially', () => {
            const pm = new OpenSpaceProcessManager();
            expect(pm.installation.found).toBe(false);
            expect(pm.installation.compatible).toBe(false);
        });
        it('should have null health initially', () => {
            const pm = new OpenSpaceProcessManager();
            expect(pm.health).toBeNull();
        });
        it('should have null wsPort initially', () => {
            const pm = new OpenSpaceProcessManager();
            expect(pm.getWebSocketPort()).toBeNull();
        });
        it('should emit state changes via callback', () => {
            const pm = new OpenSpaceProcessManager();
            const states = [];
            pm.onStateChange((state) => { states.push(state); });
            pm.setState('starting');
            expect(states).toContain('starting');
        });
        it('should skip duplicate state changes', () => {
            const pm = new OpenSpaceProcessManager();
            const states = [];
            pm.onStateChange((state) => { states.push(state); });
            pm.setState('stopped'); // already stopped
            expect(states.length).toBe(0);
        });
        it('should unregister callback when returned function is called', () => {
            const pm = new OpenSpaceProcessManager();
            const states = [];
            const unregister = pm.onStateChange((state) => { states.push(state); });
            unregister();
            pm.setState('starting');
            expect(states.length).toBe(0);
        });
    });
    describe('WebSocket port management', () => {
        it('should set and get WebSocket port', () => {
            const pm = new OpenSpaceProcessManager();
            pm.setWebSocketPort(4680);
            expect(pm.getWebSocketPort()).toBe(4680);
        });
    });
    describe('healthCheck', () => {
        it('should report unhealthy when no process handle', () => {
            const pm = new OpenSpaceProcessManager();
            const result = pm.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.details.alive).toBe(false);
            expect(result.details.wsConnected).toBe(false);
        });
        it('should report healthy with process handle and ws port', () => {
            const mockProcess = {
                pid: 12345,
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };
            const pm = new OpenSpaceProcessManager();
            pm.processHandle = mockProcess;
            pm.setWebSocketPort(4680);
            const result = pm.healthCheck();
            expect(result.healthy).toBe(true);
            expect(result.state).toBe('stopped');
            expect(typeof result.lastChecked).toBe('number');
        });
        it('should cache last health result', () => {
            const pm = new OpenSpaceProcessManager();
            pm.healthCheck();
            expect(pm.health).not.toBeNull();
            expect(pm.health.healthy).toBe(false);
        });
    });
    describe('installation detection', () => {
        function createMockProcessApi(existingCommands) {
            return {
                spawn: vi.fn(),
                execSync: vi.fn((cmd, _opts) => {
                    const entry = existingCommands[cmd];
                    if (!entry || entry.fail) {
                        throw new Error(`Command failed: ${cmd}`);
                    }
                    return entry.stdout;
                }),
            };
        }
        it('should detect installation via --version and check compatibility', () => {
            const mockApi = createMockProcessApi({
                'which openspace 2>/dev/null': { stdout: '/usr/local/bin/openspace' },
                '"/usr/local/bin/openspace" --version': { stdout: 'OpenSpace v0.19.0\n' },
                'test -x "/usr/local/bin/openspace"': { stdout: '' },
            });
            const pm = new OpenSpaceProcessManager(undefined, mockApi);
            // Override platform for test
            Object.defineProperty(process, 'platform', { value: 'linux' });
            const result = pm.detectInstallation();
            expect(result.found).toBe(true);
            expect(result.path).toBe('/usr/local/bin/openspace');
            expect(result.version).toBe('0.19.0');
            expect(result.compatible).toBe(true);
        });
        it('should mark incompatible for old version', () => {
            const mockApi = createMockProcessApi({
                'which openspace 2>/dev/null': { stdout: '/usr/bin/openspace' },
                '"/usr/bin/openspace" --version': { stdout: 'v0.18.0' },
                'test -x "/usr/bin/openspace"': { stdout: '' },
            });
            const pm = new OpenSpaceProcessManager(undefined, mockApi);
            Object.defineProperty(process, 'platform', { value: 'linux' });
            const result = pm.detectInstallation();
            expect(result.found).toBe(true);
            expect(result.compatible).toBe(false);
        });
        it('should return not found when no processApi', () => {
            const pm = new OpenSpaceProcessManager();
            const result = pm.detectInstallation();
            expect(result.found).toBe(false);
        });
        it('should not throw on detection failure', () => {
            const mockApi = createMockProcessApi({});
            const pm = new OpenSpaceProcessManager(undefined, mockApi);
            const result = pm.detectInstallation();
            expect(result.found).toBe(false);
        });
    });
    describe('start/stop', () => {
        function createMockProcessHandle(overrides = {}) {
            return {
                pid: 99999,
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(() => true),
                ...overrides,
            };
        }
        function createMockApi(handle) {
            const mockExecSync = vi.fn((cmd) => {
                if (cmd.includes('--version'))
                    return 'OpenSpace v0.19.0\n';
                if (cmd.includes('which') || cmd.includes('test'))
                    return '/usr/local/bin/openspace';
                return '';
            });
            return {
                execSync: mockExecSync,
                spawn: vi.fn(() => handle ?? createMockProcessHandle()),
            };
        }
        it('should throw when starting without installation', async () => {
            const pm = new OpenSpaceProcessManager();
            await expect(pm.start({})).rejects.toThrow('OpenSpace installation not found');
        });
        it('should throw when starting from non-stopped state', async () => {
            const mockApi = createMockApi();
            const pm = new OpenSpaceProcessManager(undefined, mockApi);
            Object.defineProperty(process, 'platform', { value: 'linux' });
            pm.detectInstallation();
            pm.setState('running');
            await expect(pm.start({})).rejects.toThrow('already in state: running');
        });
        it('should start successfully with valid installation', async () => {
            const exitHandlers = {};
            const mockHandle = createMockProcessHandle({
                on: vi.fn((event, handler) => {
                    exitHandlers[event] = handler;
                }),
            });
            const mockApi = createMockApi(mockHandle);
            const pm = new OpenSpaceProcessManager(undefined, mockApi);
            Object.defineProperty(process, 'platform', { value: 'linux' });
            pm.detectInstallation();
            await pm.start({ profile: 'default', windowless: true });
            expect(pm.runState).toBe('running');
            expect(mockApi.spawn).toHaveBeenCalledWith('/usr/local/bin/openspace', ['--profile', 'default', '--windowless'], expect.any(Object));
        });
        it('should transition to stopped on process exit', async () => {
            const exitHandlers = {};
            const mockHandle = createMockProcessHandle({
                on: vi.fn((event, handler) => {
                    exitHandlers[event] = handler;
                }),
            });
            const mockApi = createMockApi(mockHandle);
            const pm = new OpenSpaceProcessManager(undefined, mockApi);
            Object.defineProperty(process, 'platform', { value: 'linux' });
            pm.detectInstallation();
            await pm.start({});
            // Simulate process exit
            exitHandlers['exit'](0);
            expect(pm.runState).toBe('stopped');
            expect(pm.getWebSocketPort()).toBeNull();
        });
        it('should stop without error when not running', async () => {
            const pm = new OpenSpaceProcessManager();
            await pm.stop(); // should not throw
            expect(pm.runState).toBe('stopped');
        });
        it('should stop running process', async () => {
            const mockHandle = createMockProcessHandle({
                pid: undefined, // No pid = skip waitForExit, just cleanup
                on: vi.fn(),
                kill: vi.fn(),
            });
            const mockApi = createMockApi(mockHandle);
            const pm = new OpenSpaceProcessManager(undefined, mockApi);
            Object.defineProperty(process, 'platform', { value: 'linux' });
            pm.detectInstallation();
            await pm.start({});
            expect(pm.runState).toBe('running');
            await pm.stop();
            expect(pm.runState).toBe('stopped');
            expect(pm.getWebSocketPort()).toBeNull();
        });
        it('should detect WebSocket port from stdout', async () => {
            const stdoutHandlers = {};
            const mockHandle = createMockProcessHandle({
                stdout: {
                    on: vi.fn((event, handler) => {
                        stdoutHandlers[event] = handler;
                    }),
                },
                stderr: { on: vi.fn() },
                on: vi.fn(),
            });
            const mockApi = createMockApi(mockHandle);
            const pm = new OpenSpaceProcessManager(undefined, mockApi);
            Object.defineProperty(process, 'platform', { value: 'linux' });
            pm.detectInstallation();
            await pm.start({});
            // Simulate stdout with WebSocket port
            const data = Buffer.from('WebSocket server listening on port 4680');
            stdoutHandlers['data'](data);
            expect(pm.getWebSocketPort()).toBe(4680);
        });
    });
    describe('edge cases', () => {
        it('should handle multiple state change callbacks', () => {
            const pm = new OpenSpaceProcessManager();
            const log = [];
            pm.onStateChange((s) => log.push(`a:${s}`));
            pm.onStateChange((s) => log.push(`b:${s}`));
            pm.setState('starting');
            expect(log).toEqual(['a:starting', 'b:starting']);
        });
        it('should survive callback exceptions', () => {
            const pm = new OpenSpaceProcessManager();
            pm.onStateChange(() => { throw new Error('oops'); });
            pm.onStateChange((s) => { });
            // Should not throw
            pm.setState('starting');
            expect(pm.runState).toBe('starting');
        });
    });
});
//# sourceMappingURL=process-manager.test.js.map