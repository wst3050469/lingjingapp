// SSH Bash tool - execute commands on remote server via SSH, with local fallback

import type { Tool, ToolContext, ToolResult } from '@codepilot/core';
import { truncateString } from '@codepilot/core';
import { generateCommandId, storeBashOutput } from '@codepilot/core';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { executeSshCommand } from '../ssh/ssh-ipc.js';
import { getRemoteWorkspacePath } from '../ssh/session-manager.js';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT = 120_000; // 2 minutes
const MAX_OUTPUT = 100_000; // 100KB output limit

/**
 * Execute a command locally (fallback when SSH is not connected).
 */
async function executeLocalCommand(
  command: string,
  timeout: number,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const { stdout, stderr } = await execAsync(command, {
    timeout,
    maxBuffer: MAX_OUTPUT * 2,
    windowsHide: true,
  });
  return { stdout, stderr, exitCode: 0 };
}

export function createSshBashTool(getSshTerminalId: string | (() => string | null)): Tool {
  // Support both static string (backwards compat) and dynamic getter function
  const resolveId = typeof getSshTerminalId === 'function'
    ? getSshTerminalId
    : () => getSshTerminalId;

  return {
    name: 'bash',
    description: 'Execute a shell command. When SSH is connected, executes on the remote server; otherwise executes locally.',
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

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const command = params.command as string;

      // Validate required parameter
      if (!command || typeof command !== 'string') {
        return {
          content: 'Error: Missing required parameter "command". The bash tool requires a command string to execute.',
          isError: true,
        };
      }

      const timeout = (params.timeout as number) ?? DEFAULT_TIMEOUT;
      const commandId = generateCommandId();
      const startedAt = Date.now();

      // Resolve the current SSH terminal ID (may change if reconnected)
      const sshTerminalId = resolveId();

      try {
        let stdout: string;
        let stderr: string;
        let exitCode: number | null;

        if (sshTerminalId) {
          // === SSH execution ===
          const remotePath = getRemoteWorkspacePath(sshTerminalId);
          const workDir = remotePath || context.workingDirectory;
          const fullCommand = workDir
            ? `cd "${workDir}" && ${command}`
            : command;

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Command timed out')), timeout);
          });
          const execPromise = executeSshCommand(sshTerminalId, fullCommand, timeout);
          const result = await Promise.race([execPromise, timeoutPromise]);
          stdout = result.stdout;
          stderr = result.stderr;
          exitCode = result.exitCode;
        } else {
          // === Local fallback execution ===
          const workDir = context.workingDirectory;
          const fullCommand = workDir
            ? `cd "${workDir}" && ${command}`
            : command;
          // Use shell-specific command on Windows
          const shellCommand = process.platform === 'win32'
            ? `cmd /d /s /c "${fullCommand}"`
            : fullCommand;

          const result = await executeLocalCommand(shellCommand, timeout);
          stdout = result.stdout;
          stderr = result.stderr;
          exitCode = result.exitCode;
        }

        // Store output
        storeBashOutput({
          commandId,
          command,
          stdout,
          stderr,
          exitCode,
          startedAt,
          completedAt: Date.now(),
        });

        let output = '';
        if (stdout) output += truncateString(stdout, MAX_OUTPUT);
        if (stderr) {
          if (output) output += '\n';
          output += `STDERR:\n${truncateString(stderr, MAX_OUTPUT / 2)}`;
        }

        output += `\nExit code: ${exitCode ?? 'unknown'}`;
        output += `\n[command_id: ${commandId}]`;
        if (sshTerminalId) {
          output += `\n[remote: ${sshTerminalId}]`;
        }

        return {
          content: output || `Command completed with exit code ${exitCode}`,
          isError: (exitCode ?? 1) !== 0,
        };
      } catch (error: any) {
        const prefix = sshTerminalId ? 'remote' : 'local';
        return {
          content: `Error executing ${prefix} command: ${error.message}`,
          isError: true,
        };
      }
    },
  };
}
