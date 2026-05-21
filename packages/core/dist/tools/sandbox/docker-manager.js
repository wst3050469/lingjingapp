// Docker Sandbox Manager — route dangerous commands to isolated containers
//
// When bash commands trigger safety rules, the Docker manager creates
// ephemeral containers with read-only workspace mounts to safely
// execute the command without risking the host filesystem.
//
// Inspired by Hermes Agent's multi-backend sandbox system.
import { spawn, execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
// ── Danger patterns ──
const DANGER_PATTERNS = [
    /\brm\s+(-[rRf]+\s+)*\//, // rm -rf /
    /\brm\s+(-[rRf]+\s+)*\*/, // rm -rf *
    /\brm\s+(-[rRf]+\s+)*\.\//, // rm -rf ./
    /\brmdir\b/,
    /\bmv\s+\//, // mv /
    /\bchmod\s+777\b/,
    /\bchown\s/,
    /\bsudo\b/,
    /\bdd\s+if=/,
    /\bmkfs\./,
    /\b>:?\s*\/dev\//,
    /\bcurl\b.*\|\s*(ba)?sh\b/, // curl | bash
    /\bwget\b.*\|\s*sh\b/,
];
// Blocked patterns — never allow, even in sandbox
const BLOCKED_PATTERNS = [
    /\b>\/dev\/sd[a-z]\b/,
    /\bdd\s+of=\/dev\//,
    /\bmount\s/,
    /\bformat\s/,
];
export class DockerSandboxManager {
    config;
    dockerAvailable = null;
    constructor(config) {
        this.config = config;
    }
    /**
     * Check if Docker is available on this machine.
     */
    checkDocker() {
        if (this.dockerAvailable !== null)
            return this.dockerAvailable;
        try {
            execSync('docker info --format "{{.OperatingSystem}}"', { stdio: 'ignore', timeout: 5000 });
            this.dockerAvailable = true;
            logger.info('[Sandbox] Docker is available');
        }
        catch {
            this.dockerAvailable = false;
            logger.warn('[Sandbox] Docker is NOT available — sandbox features disabled');
        }
        return this.dockerAvailable;
    }
    /**
     * Determine if a command should be sandboxed.
     */
    shouldSandbox(command) {
        if (!this.config.enabled)
            return false;
        if (!this.checkDocker())
            return false;
        if (this.config.mode === 'all')
            return true;
        // Check blocked patterns first — these are NEVER allowed
        for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(command)) {
                logger.warn(`[Sandbox] BLOCKED command: ${command.slice(0, 100)}`);
                return false; // blocked, not sandboxed
            }
        }
        // Check danger patterns
        for (const pattern of DANGER_PATTERNS) {
            if (pattern.test(command)) {
                logger.info(`[Sandbox] Will sandbox: ${command.slice(0, 100)}`);
                return true;
            }
        }
        return false;
    }
    /**
     * Execute a command in a Docker sandbox container.
     */
    async execute(command, timeoutMs) {
        const containerName = `lingjing-sandbox-${randomUUID().slice(0, 8)}`;
        const wsAbs = resolve(this.config.workspacePath);
        return new Promise((resolvePromise) => {
            const stdoutBufs = [];
            const stderrBufs = [];
            // docker run --rm --name <name> \
            //   --read-only \
            //   -v <workspace>:/workspace:ro \
            //   -w /workspace \
            //   --network none \
            //   --memory 512m \
            //   --cpus 1 \
            //   --timeout <timeout> \
            //   <image> sh -c '<command>'
            const args = [
                'run', '--rm',
                '--name', containerName,
                '--read-only',
                '--tmpfs', '/tmp:exec',
                '-v', `${wsAbs}:/workspace:ro`,
                '-w', '/workspace',
                '--network', 'none',
                '--memory', '512m',
                '--cpus', '1',
                this.config.image,
                'sh', '-c', command,
            ];
            const proc = spawn('docker', args, {
                timeout: timeoutMs,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            proc.stdout?.on('data', (chunk) => stdoutBufs.push(chunk));
            proc.stderr?.on('data', (chunk) => stderrBufs.push(chunk));
            proc.on('close', (code) => {
                resolvePromise({
                    stdout: Buffer.concat(stdoutBufs).toString('utf8').slice(0, 50000),
                    stderr: Buffer.concat(stderrBufs).toString('utf8').slice(0, 10000),
                    exitCode: code ?? 1,
                    sandboxed: true,
                });
            });
            proc.on('error', (err) => {
                resolvePromise({
                    stdout: '',
                    stderr: `Sandbox launch failed: ${err.message}`,
                    exitCode: 1,
                    sandboxed: true,
                });
            });
        });
    }
}
//# sourceMappingURL=docker-manager.js.map