// Bash tool - execute shell commands
import { spawn, execSync } from 'node:child_process';
import { truncateString } from '../../utils/truncate.js';
import { decodeBuffer } from '../../utils/encoding.js';
import { generateCommandId, storeBashOutput } from './bash-output-store.js';
import { DockerSandboxManager } from '../sandbox/docker-manager.js';
/**
 * Module-level sandbox manager — configured externally via configureSandbox().
 * When enabled, dangerous commands are routed to Docker containers.
 */
let sandboxManager = null;
export function configureSandbox(config) {
    if (config.enabled) {
        sandboxManager = new DockerSandboxManager({
            enabled: true,
            mode: 'auto',
            image: 'alpine:latest',
            workspacePath: config.workspacePath,
            timeoutSec: 120,
        });
    }
    else {
        sandboxManager = null;
    }
}
/**
 * Kill a process and all its children using OS-specific mechanisms.
 * On Windows, uses taskkill /F /T /PID for full process-tree termination.
 * On POSIX, kills the entire process group with SIGKILL.
 */
function killProcessTree(pid) {
    try {
        if (process.platform === 'win32') {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
            return true;
        }
        process.kill(-pid, 'SIGKILL');
        return true;
    }
    catch {
        return false;
    }
}
const DEFAULT_TIMEOUT = 120_000; // 2 minutes
const MAX_OUTPUT = 100_000; // 100KB output limit
export const bashTool = {
    name: 'bash',
    description: 'Execute a shell command in the working directory. Returns stdout and stderr. Use for git, npm, build commands, etc.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The shell command to execute',
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds. Default: 120000 (2 minutes)',
            },
        },
        required: ['command'],
    },
    async execute(params, context) {
        const command = params.command;
        // Validate required parameter
        if (!command || typeof command !== 'string') {
            return {
                content: 'Error: Missing required parameter "command". The bash tool requires a command string to execute.',
                isError: true,
            };
        }
        const timeout = params.timeout ?? DEFAULT_TIMEOUT;
        // ── Lazy-init Docker sandbox from ToolContext ──
        if (context.enableSandbox && !sandboxManager) {
            configureSandbox({ enabled: true, workspacePath: context.workingDirectory });
        }
        // ── Docker sandbox: route dangerous commands to isolated containers ──
        if (sandboxManager?.shouldSandbox(command)) {
            const result = await sandboxManager.execute(command, timeout);
            const output = result.stdout
                ? `[SANDBOXED in Docker]\n${truncateString(result.stdout, MAX_OUTPUT)}`
                : '';
            const errOut = result.stderr ? `\nSTDERR:\n${truncateString(result.stderr, MAX_OUTPUT / 2)}` : '';
            return {
                content: `${output}${errOut}\nExit code: ${result.exitCode}`,
                isError: result.exitCode !== 0,
            };
        }
        const commandId = generateCommandId();
        const startedAt = Date.now();
        return new Promise((resolvePromise) => {
            const stdoutBufs = [];
            const stderrBufs = [];
            let stdoutLen = 0;
            /** Why the process was killed: null = completed naturally */
            let killReason = null;
            let timeoutCleared = false;
            // Use cmd.exe on Windows, sh on others
            // On Windows, prepend chcp 65001 to switch console code page to UTF-8
            // so that command output (e.g. ipconfig) is decoded correctly instead of GBK mojibake
            const isWindows = process.platform === 'win32';
            const shell = isWindows ? 'cmd.exe' : '/bin/sh';
            const shellArgs = isWindows
                ? ['/c', `chcp 65001 >nul && ${command}`]
                : ['-c', command];
            const child = spawn(shell, shellArgs, {
                cwd: context.workingDirectory,
                env: process.env,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            const timer = setTimeout(() => {
                timeoutCleared = true;
                killReason = 'timeout';
                child.kill('SIGTERM');
                killProcessTree(child.pid);
                setTimeout(() => { child.kill('SIGKILL'); killProcessTree(child.pid); }, 5000);
            }, timeout);
            child.stdout?.on('data', (data) => {
                stdoutBufs.push(data);
                stdoutLen += data.length;
                context.onProgress?.(decodeBuffer(data));
                if (stdoutLen > MAX_OUTPUT && !killReason) {
                    // Defer kill to avoid race with timeout clearing
                    setTimeout(() => {
                        if (!timeoutCleared) {
                            killReason = 'output_overflow';
                            child.kill('SIGTERM');
                            killProcessTree(child.pid);
                        }
                    }, 0);
                }
            });
            child.stderr?.on('data', (data) => {
                stderrBufs.push(data);
            });
            // Handle abort signal
            const abortHandler = () => {
                timeoutCleared = true;
                killReason = 'aborted';
                child.kill('SIGTERM');
                killProcessTree(child.pid);
            };
            context.signal.addEventListener('abort', abortHandler, { once: true });
            child.on('close', (code) => {
                clearTimeout(timer);
                context.signal.removeEventListener('abort', abortHandler);
                // Decode accumulated buffers with GBK fallback on Windows
                const stdout = decodeBuffer(Buffer.concat(stdoutBufs));
                const stderr = decodeBuffer(Buffer.concat(stderrBufs));
                // Store output for later retrieval
                storeBashOutput({
                    commandId,
                    command,
                    stdout,
                    stderr,
                    exitCode: code,
                    startedAt,
                    completedAt: Date.now(),
                });
                let output = '';
                if (stdout)
                    output += truncateString(stdout, MAX_OUTPUT);
                if (stderr) {
                    if (output)
                        output += '\n';
                    output += `STDERR:\n${truncateString(stderr, MAX_OUTPUT / 2)}`;
                }
                if (killReason === 'timeout') {
                    output += `\n(Process timed out after ${timeout / 1000}s. Try a longer timeout or split into smaller steps.)`;
                }
                else if (killReason === 'output_overflow') {
                    output += '\n(Output exceeded 100KB limit and was truncated.)';
                }
                else if (killReason === 'aborted') {
                    output += '\n(Process was aborted.)';
                }
                output += `\nExit code: ${code ?? 'unknown'}`;
                output += `\n[command_id: ${commandId}]`;
                resolvePromise({
                    content: output || `Command completed with exit code ${code}`,
                    isError: (code ?? 1) !== 0,
                });
            });
            child.on('error', (error) => {
                clearTimeout(timer);
                context.signal.removeEventListener('abort', abortHandler);
                resolvePromise({
                    content: `Error executing command: ${error.message}`,
                    isError: true,
                });
            });
        });
    },
};
//# sourceMappingURL=bash.js.map