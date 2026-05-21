export interface SandboxResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    sandboxed: true;
}
export interface DockerManagerConfig {
    enabled: boolean;
    /** 'auto' = sandbox dangerous commands, 'all' = sandbox everything */
    mode: 'auto' | 'all';
    image: string;
    workspacePath: string;
    timeoutSec: number;
}
export declare class DockerSandboxManager {
    private config;
    private dockerAvailable;
    constructor(config: DockerManagerConfig);
    /**
     * Check if Docker is available on this machine.
     */
    checkDocker(): boolean;
    /**
     * Determine if a command should be sandboxed.
     */
    shouldSandbox(command: string): boolean;
    /**
     * Execute a command in a Docker sandbox container.
     */
    execute(command: string, timeoutMs: number): Promise<SandboxResult>;
}
//# sourceMappingURL=docker-manager.d.ts.map