import type { ProcessRunState, InstallationDetection, StartConfig, HealthCheckResult } from './types.js';
import type { IEventBus } from '../event-bus/types.js';
export interface IChildProcess {
    spawn(command: string, args: string[], options: Record<string, unknown>): IChildProcessHandle;
    execSync(command: string, options?: Record<string, unknown>): string;
}
export interface IChildProcessHandle {
    pid: number | undefined;
    stdout: {
        on(event: string, listener: (data: Buffer) => void): void;
    };
    stderr: {
        on(event: string, listener: (data: Buffer) => void): void;
    };
    on(event: string, listener: (...args: unknown[]) => void): void;
    kill(signal: string): boolean;
}
export type StateChangeCallback = (state: ProcessRunState, previous: ProcessRunState) => void;
export declare class OpenSpaceProcessManager {
    private _runState;
    private processHandle;
    private healthTimer;
    private wsPort;
    private lastHealth;
    private stateChangeCallbacks;
    private readonly eventBus;
    private readonly processApi;
    private detectedInstallation;
    constructor(eventBus?: IEventBus, processApi?: IChildProcess);
    get runState(): ProcessRunState;
    get installation(): InstallationDetection;
    get health(): HealthCheckResult | null;
    onStateChange(callback: StateChangeCallback): () => void;
    private setState;
    detectInstallation(): InstallationDetection;
    private detectWindows;
    private detectUnix;
    private finalizeDetection;
    start(config?: StartConfig): Promise<void>;
    stop(): Promise<void>;
    private sendGracefulExit;
    private waitForExit;
    healthCheck(): HealthCheckResult;
    private startHealthCheck;
    private stopHealthCheck;
    getWebSocketPort(): number | null;
    setWebSocketPort(port: number): void;
}
//# sourceMappingURL=process-manager.d.ts.map