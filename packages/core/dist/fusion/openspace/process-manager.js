import { logger } from '../../utils/logger.js';
const OPENSPACE_MIN_VERSION = '0.19.0';
const HEALTH_CHECK_INTERVAL = 5000;
const GRACEFUL_STOP_TIMEOUT = 10000;
const FORCE_STOP_TIMEOUT = 5000;
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const na = pa[i] ?? 0;
        const nb = pb[i] ?? 0;
        if (na < nb)
            return -1;
        if (na > nb)
            return 1;
    }
    return 0;
}
export class OpenSpaceProcessManager {
    _runState = 'stopped';
    processHandle = null;
    healthTimer = null;
    wsPort = null;
    lastHealth = null;
    stateChangeCallbacks = new Set();
    eventBus;
    processApi;
    detectedInstallation = { found: false, compatible: false };
    constructor(eventBus, processApi) {
        this.eventBus = eventBus ?? null;
        this.processApi = processApi ?? null;
    }
    get runState() {
        return this._runState;
    }
    get installation() {
        return this.detectedInstallation;
    }
    get health() {
        return this.lastHealth;
    }
    onStateChange(callback) {
        this.stateChangeCallbacks.add(callback);
        return () => { this.stateChangeCallbacks.delete(callback); };
    }
    setState(newState) {
        const prev = this._runState;
        if (prev === newState)
            return;
        this._runState = newState;
        logger.info(`[OpenSpaceProcessManager] state: ${prev} -> ${newState}`);
        for (const cb of this.stateChangeCallbacks) {
            try {
                cb(newState, prev);
            }
            catch { /* ignore */ }
        }
    }
    detectInstallation() {
        if (!this.processApi) {
            this.detectedInstallation = { found: false, compatible: false };
            return this.detectedInstallation;
        }
        const platform = process.platform;
        try {
            if (platform === 'win32') {
                return this.detectWindows();
            }
            else if (platform === 'linux' || platform === 'darwin') {
                return this.detectUnix();
            }
        }
        catch (err) {
            logger.warn(`[OpenSpaceProcessManager] detection failed: ${err.message}`);
        }
        this.detectedInstallation = { found: false, compatible: false };
        return this.detectedInstallation;
    }
    detectWindows() {
        const regQuery = 'reg query "HKLM\\SOFTWARE\\OpenSpace" /v InstallPath 2>nul';
        try {
            const output = this.processApi.execSync(regQuery, { encoding: 'utf-8' });
            const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/);
            if (match && match[1]) {
                const path = match[1].trim();
                return this.finalizeDetection(path, 'registry');
            }
        }
        catch { /* registry not found */ }
        try {
            const whereOut = this.processApi.execSync('where openspace 2>nul', { encoding: 'utf-8' });
            const path = whereOut.trim().split('\n')[0].trim();
            if (path)
                return this.finalizeDetection(path, 'path');
        }
        catch { /* not in PATH */ }
        const commonPaths = [
            'C:\\Program Files\\OpenSpace\\bin\\OpenSpace.exe',
            'C:\\Program Files (x86)\\OpenSpace\\bin\\OpenSpace.exe',
        ];
        for (const p of commonPaths) {
            try {
                this.processApi.execSync(`if exist "${p}" echo found`, { encoding: 'utf-8' });
                return this.finalizeDetection(p, 'common_path');
            }
            catch { /* not found */ }
        }
        this.detectedInstallation = { found: false, compatible: false };
        return this.detectedInstallation;
    }
    detectUnix() {
        try {
            const whichOut = this.processApi.execSync('which openspace 2>/dev/null', { encoding: 'utf-8' });
            const path = whichOut.trim();
            if (path)
                return this.finalizeDetection(path, 'path');
        }
        catch { /* not in PATH */ }
        const unixPaths = ['/opt/openspace/bin/openspace', '/usr/local/bin/openspace'];
        for (const p of unixPaths) {
            try {
                this.processApi.execSync(`test -x "${p}"`, { encoding: 'utf-8' });
                return this.finalizeDetection(p, 'common_path');
            }
            catch { /* not found */ }
        }
        this.detectedInstallation = { found: false, compatible: false };
        return this.detectedInstallation;
    }
    finalizeDetection(path, method) {
        let version;
        let compatible = false;
        try {
            const verOut = this.processApi.execSync(`"${path}" --version`, {
                encoding: 'utf-8',
                timeout: 5000,
            });
            const match = verOut.match(/(\d+\.\d+\.\d+)/);
            if (match) {
                version = match[1];
                compatible = compareVersions(version, OPENSPACE_MIN_VERSION) >= 0;
            }
        }
        catch { /* version detection failed */ }
        this.detectedInstallation = { found: true, path, version, compatible, method };
        return this.detectedInstallation;
    }
    async start(config = {}) {
        if (this._runState !== 'stopped') {
            throw new Error(`OpenSpace already in state: ${this._runState}`);
        }
        if (!this.detectedInstallation.found || !this.detectedInstallation.path) {
            const detected = this.detectInstallation();
            if (!detected.found || !detected.path) {
                throw new Error('OpenSpace installation not found');
            }
        }
        if (!this.detectedInstallation.compatible) {
            logger.warn(`[OpenSpaceProcessManager] version ${this.detectedInstallation.version} may not be compatible (min: ${OPENSPACE_MIN_VERSION})`);
        }
        this.setState('starting');
        const execPath = this.detectedInstallation.path;
        const args = [];
        if (config.profile)
            args.push('--profile', config.profile);
        if (config.windowless)
            args.push('--windowless');
        if (config.additionalArgs)
            args.push(...config.additionalArgs);
        try {
            this.processHandle = this.processApi.spawn(execPath, args, {
                detached: false,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            this.processHandle.stdout.on('data', (data) => {
                const text = data.toString();
                const wsMatch = text.match(/WebSocket.*on.*port\s+(\d+)/i);
                if (wsMatch) {
                    this.wsPort = parseInt(wsMatch[1], 10);
                    logger.info(`[OpenSpaceProcessManager] detected ws port: ${this.wsPort}`);
                }
            });
            this.processHandle.stderr.on('data', (data) => {
                logger.warn(`[OpenSpaceProcessManager] stderr: ${data.toString().trim()}`);
            });
            this.processHandle.on('exit', (code) => {
                logger.info(`[OpenSpaceProcessManager] process exited with code: ${code}`);
                this.stopHealthCheck();
                this.wsPort = null;
                this.processHandle = null;
                this.setState('stopped');
            });
            this.processHandle.on('error', (err) => {
                logger.error(`[OpenSpaceProcessManager] process error: ${err.message}`);
                this.setState('error');
            });
            this.setState('running');
            this.startHealthCheck();
            if (this.eventBus) {
                this.eventBus.publish('openspace:started', { pid: this.processHandle.pid, wsPort: this.wsPort }, 'openspace-process-manager');
            }
        }
        catch (err) {
            this.setState('error');
            throw new Error(`Failed to start OpenSpace: ${err.message}`);
        }
    }
    async stop() {
        if (this._runState !== 'running' && this._runState !== 'error') {
            return;
        }
        this.setState('stopping');
        this.stopHealthCheck();
        if (this.processHandle && this.processHandle.pid) {
            try {
                const gracefulScript = 'openspace.exit()';
                if (this.wsPort) {
                    logger.info('[OpenSpaceProcessManager] sending graceful exit via Lua script');
                    await this.sendGracefulExit(gracefulScript);
                }
                await this.waitForExit(GRACEFUL_STOP_TIMEOUT);
                if (this.processHandle && this.processHandle.pid) {
                    logger.info('[OpenSpaceProcessManager] sending SIGTERM');
                    this.processHandle.kill('SIGTERM');
                    await this.waitForExit(FORCE_STOP_TIMEOUT);
                }
                if (this.processHandle && this.processHandle.pid) {
                    logger.info('[OpenSpaceProcessManager] sending SIGKILL');
                    this.processHandle.kill('SIGKILL');
                }
            }
            catch (err) {
                logger.error(`[OpenSpaceProcessManager] stop error: ${err.message}`);
            }
        }
        this.processHandle = null;
        this.wsPort = null;
        this.setState('stopped');
        if (this.eventBus) {
            this.eventBus.publish('openspace:stopped', {}, 'openspace-process-manager');
        }
    }
    async sendGracefulExit(script) {
        return new Promise((resolve) => {
            setTimeout(resolve, 2000);
        });
    }
    waitForExit(timeoutMs) {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                if (!this.processHandle || !this.processHandle.pid) {
                    resolve();
                    return;
                }
                if (Date.now() - start >= timeoutMs) {
                    resolve();
                    return;
                }
                setTimeout(check, 500);
            };
            check();
        });
    }
    healthCheck() {
        const alive = this.processHandle !== null && this.processHandle.pid !== undefined;
        const wsConnected = this.wsPort !== null;
        const details = {
            alive,
            wsConnected,
        };
        const result = {
            healthy: alive && wsConnected,
            state: this._runState,
            details,
            lastChecked: Date.now(),
        };
        const prevHealthy = this.lastHealth?.healthy;
        this.lastHealth = result;
        if (prevHealthy !== result.healthy && this.eventBus) {
            this.eventBus.publish('openspace:health_changed', result, 'openspace-process-manager');
        }
        return result;
    }
    startHealthCheck() {
        this.stopHealthCheck();
        this.healthTimer = setInterval(() => {
            this.healthCheck();
        }, HEALTH_CHECK_INTERVAL);
    }
    stopHealthCheck() {
        if (this.healthTimer !== null) {
            clearInterval(this.healthTimer);
            this.healthTimer = null;
        }
    }
    getWebSocketPort() {
        return this.wsPort;
    }
    setWebSocketPort(port) {
        this.wsPort = port;
    }
}
//# sourceMappingURL=process-manager.js.map