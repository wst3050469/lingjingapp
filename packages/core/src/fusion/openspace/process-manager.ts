import type {
  ProcessRunState,
  InstallationDetection,
  StartConfig,
  ProcessHealthStatus,
  HealthCheckResult,
} from './types.js';
import type { IEventBus, EventTopic } from '../event-bus/types.js';
import { logger } from '../../utils/logger.js';

export interface IChildProcess {
  spawn(command: string, args: string[], options: Record<string, unknown>): IChildProcessHandle;
  execSync(command: string, options?: Record<string, unknown>): string;
}

export interface IChildProcessHandle {
  pid: number | undefined;
  stdout: { on(event: string, listener: (data: Buffer) => void): void };
  stderr: { on(event: string, listener: (data: Buffer) => void): void };
  on(event: string, listener: (...args: unknown[]) => void): void;
  kill(signal: string): boolean;
}

export type StateChangeCallback = (state: ProcessRunState, previous: ProcessRunState) => void;

const OPENSPACE_MIN_VERSION = '0.19.0';
const HEALTH_CHECK_INTERVAL = 5000;
const GRACEFUL_STOP_TIMEOUT = 10000;
const FORCE_STOP_TIMEOUT = 5000;

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

export class OpenSpaceProcessManager {
  private _runState: ProcessRunState = 'stopped';
  private processHandle: IChildProcessHandle | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private wsPort: number | null = null;
  private lastHealth: HealthCheckResult | null = null;
  private stateChangeCallbacks: Set<StateChangeCallback> = new Set();
  private readonly eventBus: IEventBus | null;
  private readonly processApi: IChildProcess | null;
  private detectedInstallation: InstallationDetection = { found: false, compatible: false };

  constructor(eventBus?: IEventBus, processApi?: IChildProcess) {
    this.eventBus = eventBus ?? null;
    this.processApi = processApi ?? null;
  }

  get runState(): ProcessRunState {
    return this._runState;
  }

  get installation(): InstallationDetection {
    return this.detectedInstallation;
  }

  get health(): HealthCheckResult | null {
    return this.lastHealth;
  }

  onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => { this.stateChangeCallbacks.delete(callback); };
  }

  private setState(newState: ProcessRunState): void {
    const prev = this._runState;
    if (prev === newState) return;
    this._runState = newState;
    logger.info(`[OpenSpaceProcessManager] state: ${prev} -> ${newState}`);
    for (const cb of this.stateChangeCallbacks) {
      try { cb(newState, prev); } catch { /* ignore */ }
    }
  }

  detectInstallation(): InstallationDetection {
    if (!this.processApi) {
      this.detectedInstallation = { found: false, compatible: false };
      return this.detectedInstallation;
    }

    const platform = process.platform;

    try {
      if (platform === 'win32') {
        return this.detectWindows();
      } else if (platform === 'linux' || platform === 'darwin') {
        return this.detectUnix();
      }
    } catch (err) {
      logger.warn(`[OpenSpaceProcessManager] detection failed: ${(err as Error).message}`);
    }

    this.detectedInstallation = { found: false, compatible: false };
    return this.detectedInstallation;
  }

  private detectWindows(): InstallationDetection {
    const regQuery = 'reg query "HKLM\\SOFTWARE\\OpenSpace" /v InstallPath 2>nul';
    try {
      const output = this.processApi!.execSync(regQuery, { encoding: 'utf-8' });
      const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/);
      if (match && match[1]) {
        const path = match[1].trim();
        return this.finalizeDetection(path, 'registry');
      }
    } catch { /* registry not found */ }

    try {
      const whereOut = this.processApi!.execSync('where openspace 2>nul', { encoding: 'utf-8' });
      const path = whereOut.trim().split('\n')[0].trim();
      if (path) return this.finalizeDetection(path, 'path');
    } catch { /* not in PATH */ }

    const commonPaths = [
      'C:\\Program Files\\OpenSpace\\bin\\OpenSpace.exe',
      'C:\\Program Files (x86)\\OpenSpace\\bin\\OpenSpace.exe',
    ];
    for (const p of commonPaths) {
      try {
        this.processApi!.execSync(`if exist "${p}" echo found`, { encoding: 'utf-8' });
        return this.finalizeDetection(p, 'common_path');
      } catch { /* not found */ }
    }

    this.detectedInstallation = { found: false, compatible: false };
    return this.detectedInstallation;
  }

  private detectUnix(): InstallationDetection {
    try {
      const whichOut = this.processApi!.execSync('which openspace 2>/dev/null', { encoding: 'utf-8' });
      const path = whichOut.trim();
      if (path) return this.finalizeDetection(path, 'path');
    } catch { /* not in PATH */ }

    const unixPaths = ['/opt/openspace/bin/openspace', '/usr/local/bin/openspace'];
    for (const p of unixPaths) {
      try {
        this.processApi!.execSync(`test -x "${p}"`, { encoding: 'utf-8' });
        return this.finalizeDetection(p, 'common_path');
      } catch { /* not found */ }
    }

    this.detectedInstallation = { found: false, compatible: false };
    return this.detectedInstallation;
  }

  private finalizeDetection(path: string, method: string): InstallationDetection {
    let version: string | undefined;
    let compatible = false;

    try {
      const verOut = this.processApi!.execSync(`"${path}" --version`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const match = verOut.match(/(\d+\.\d+\.\d+)/);
      if (match) {
        version = match[1];
        compatible = compareVersions(version, OPENSPACE_MIN_VERSION) >= 0;
      }
    } catch { /* version detection failed */ }

    this.detectedInstallation = { found: true, path, version, compatible, method };
    return this.detectedInstallation;
  }

  async start(config: StartConfig = {}): Promise<void> {
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

    const execPath = this.detectedInstallation.path!;
    const args: string[] = [];

    if (config.profile) args.push('--profile', config.profile);
    if (config.windowless) args.push('--windowless');
    if (config.additionalArgs) args.push(...config.additionalArgs);

    try {
      this.processHandle = this.processApi!.spawn(execPath, args, {
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.processHandle.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        const wsMatch = text.match(/WebSocket.*on.*port\s+(\d+)/i);
        if (wsMatch) {
          this.wsPort = parseInt(wsMatch[1], 10);
          logger.info(`[OpenSpaceProcessManager] detected ws port: ${this.wsPort}`);
        }
      });

      this.processHandle.stderr.on('data', (data: Buffer) => {
        logger.warn(`[OpenSpaceProcessManager] stderr: ${data.toString().trim()}`);
      });

      this.processHandle.on('exit', (code: unknown) => {
        logger.info(`[OpenSpaceProcessManager] process exited with code: ${code}`);
        this.stopHealthCheck();
        this.wsPort = null;
        this.processHandle = null;
        this.setState('stopped');
      });

      this.processHandle.on('error', (err: unknown) => {
        logger.error(`[OpenSpaceProcessManager] process error: ${(err as Error).message}`);
        this.setState('error');
      });

      this.setState('running');
      this.startHealthCheck();

      if (this.eventBus) {
        this.eventBus.publish('openspace:started' as EventTopic, { pid: this.processHandle.pid, wsPort: this.wsPort }, 'openspace-process-manager');
      }
    } catch (err) {
      this.setState('error');
      throw new Error(`Failed to start OpenSpace: ${(err as Error).message}`);
    }
  }

  async stop(): Promise<void> {
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
      } catch (err) {
        logger.error(`[OpenSpaceProcessManager] stop error: ${(err as Error).message}`);
      }
    }

    this.processHandle = null;
    this.wsPort = null;
    this.setState('stopped');

    if (this.eventBus) {
      this.eventBus.publish('openspace:stopped' as EventTopic, {}, 'openspace-process-manager');
    }
  }

  private async sendGracefulExit(script: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
  }

  private waitForExit(timeoutMs: number): Promise<void> {
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

  healthCheck(): HealthCheckResult {
    const alive = this.processHandle !== null && this.processHandle.pid !== undefined;
    const wsConnected = this.wsPort !== null;

    const details: ProcessHealthStatus = {
      alive,
      wsConnected,
    };

    const result: HealthCheckResult = {
      healthy: alive && wsConnected,
      state: this._runState,
      details,
      lastChecked: Date.now(),
    };

    const prevHealthy = this.lastHealth?.healthy;
    this.lastHealth = result;

    if (prevHealthy !== result.healthy && this.eventBus) {
      this.eventBus.publish('openspace:health_changed' as EventTopic, result, 'openspace-process-manager');
    }

    return result;
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthTimer = setInterval(() => {
      this.healthCheck();
    }, HEALTH_CHECK_INTERVAL);
  }

  private stopHealthCheck(): void {
    if (this.healthTimer !== null) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  getWebSocketPort(): number | null {
    return this.wsPort;
  }

  setWebSocketPort(port: number): void {
    this.wsPort = port;
  }
}
