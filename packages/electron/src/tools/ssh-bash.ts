// SSH Bash tool - execute commands on remote server via SSH

import type { Tool, ToolContext, ToolResult } from '@codepilot/core';
import { truncateString } from '@codepilot/core';
import { generateCommandId, storeBashOutput } from '@codepilot/core';
import { executeSshCommand } from '../ssh/ssh-ipc.js';
import { getRemoteWorkspacePath } from '../ssh/session-manager.js';

const DEFAULT_TIMEOUT = 120_000; // 2 minutes
const MAX_OUTPUT = 100_000; // 100KB output limit

export function createSshBashTool(getSshTerminalId: string | (() => string | null)): Tool {
  // Support both static string (backwards compat) and dynamic getter function
  const resolveId = typeof getSshTerminalId === 'function'
    ? getSshTerminalId
    : () => getSshTerminalId;

  return {
    name: 'bash',
    description: 'Execute a shell command on the remote server via SSH. Returns stdout and stderr. Use for git, npm, build commands, etc.',
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

      // Resolve the current SSH terminal ID (may change if reconnected)
      const sshTerminalId = resolveId();
      if (!sshTerminalId) {
        return {
          content: 'Error: SSH 未连接。请先在"远程"面板中连接到 SSH 服务器。',
          isError: true,
        };
      }

      const timeout = (params.timeout as number) ?? DEFAULT_TIMEOUT;
      const commandId = generateCommandId();
      const startedAt = Date.now();

      try {
        // Use remote workspace path if available, otherwise fall back to context.workingDirectory
        const remotePath = getRemoteWorkspacePath(sshTerminalId);
        const workDir = remotePath || context.workingDirectory;

        // Build command with cd for working directory
        const fullCommand = workDir
          ? `cd "${workDir}" && ${command}`
          : command;

        // Execute with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Command timed out')), timeout);
        });

        const execPromise = executeSshCommand(sshTerminalId, fullCommand, timeout);

        const result = await Promise.race([execPromise, timeoutPromise]);

        // Store output
// @ts-expect-error - TS2554: Expected 2 arguments, but got 1
        storeBashOutput({
          commandId,
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          startedAt,
          completedAt: Date.now(),
        });

        let output = '';
        if (result.stdout) output += truncateString(result.stdout, MAX_OUTPUT);
        if (result.stderr) {
          if (output) output += '\n';
          output += `STDERR:\n${truncateString(result.stderr, MAX_OUTPUT / 2)}`;
        }

        output += `\nExit code: ${result.exitCode ?? 'unknown'}`;
        output += `\n[command_id: ${commandId}]`;
        output += `\n[remote: ${sshTerminalId}]`;

        return {
          content: output || `Command completed with exit code ${result.exitCode}`,
          isError: (result.exitCode ?? 1) !== 0,
        };
      } catch (error: any) {
        return {
          content: `Error executing remote command: ${error.message}`,
          isError: true,
        };
      }
    },
  };
}
