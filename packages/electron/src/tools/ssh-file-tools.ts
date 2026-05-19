// SSH File tools - read/write/edit files on remote server via SFTP

import type { Tool, ToolContext, ToolResult } from '@codepilot/core';
import { resolve, dirname } from 'node:path';

// SSH session manager - accesses the global sshSessions map
import { getSftpSession, getRemoteWorkspacePath } from '../ssh/session-manager.js';

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;

type SshIdArg = string | (() => string | null);

/** Resolve the SSH terminal ID from a static string or getter function. */
function resolveSshId(arg: SshIdArg): string | null {
  return typeof arg === 'function' ? arg() : arg;
}

/**
 * Helper to resolve file path: uses remote workspace path if available,
 * otherwise falls back to context.workingDirectory.
 * IMPORTANT: For remote paths, we must use POSIX path separators (/),
 * not Windows separators (\).
 */
function resolveRemotePath(filePath: string, sshTerminalId: string, context: ToolContext): string {
  // Check for POSIX absolute paths (Linux/Mac)
  if (filePath.startsWith('/')) {
    return filePath;
  }
  // Check for Windows absolute paths
  if (/^[a-zA-Z]:[\\/]/.test(filePath)) {
    return filePath;
  }

  // For relative paths, prefer the remote workspace path
  const remotePath = getRemoteWorkspacePath(sshTerminalId);
  if (remotePath) {
    // Use POSIX path joining for remote Linux paths
    const normalizedBase = remotePath.endsWith('/') ? remotePath.slice(0, -1) : remotePath;
    const normalizedFile = filePath.startsWith('./') ? filePath.slice(2) : filePath;
    return `${normalizedBase}/${normalizedFile}`;
  }

  // Fallback to local working directory
  return resolve(context.workingDirectory, filePath);
}

/**
 * SSH File Read Tool
 * Reads files from remote server via SFTP
 */
export function createSshFileReadTool(getSshTerminalId: SshIdArg): Tool {
  return {
    name: 'file_read',
    description: 'Read a file from the remote server via SFTP. Returns file content with line numbers. Supports offset and limit for large files.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to read (absolute or relative to working directory)',
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (1-based). Optional.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of lines to read. Optional, defaults to 2000.',
        },
      },
      required: ['file_path'],
    },

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const filePath = params.file_path as string;
      const offset = (params.offset as number) ?? 1;
      const limit = (params.limit as number) ?? DEFAULT_READ_LIMIT;

      if (!filePath) {
        return {
          content: 'Error: Missing required parameter "file_path"',
          isError: true,
        };
      }

      const sshTerminalId = resolveSshId(getSshTerminalId);
      if (!sshTerminalId) {
        return { content: 'Error: SSH 未连接。请先在"远程"面板中连接到 SSH 服务器。', isError: true };
      }

      const absolutePath = resolveRemotePath(filePath, sshTerminalId, context);

      try {
        const sftp = getSftpSession(sshTerminalId);
        if (!sftp) {
          return {
            content: `Error: No SFTP session available for terminal ${sshTerminalId}`,
            isError: true,
          };
        }

        const content = await new Promise<string>((resolve, reject) => {
          sftp.readFile(absolutePath, (err: Error | null | undefined, data: Buffer) => {
            if (err) return reject(err);
            resolve(data.toString('utf8'));
          });
        });

        const lines = content.split('\n');
        const startLine = Math.max(1, offset);
        const endLine = Math.min(lines.length, startLine + limit - 1);
        const selectedLines = lines.slice(startLine - 1, endLine);

        // Format with line numbers (like cat -n)
        const maxLineNumWidth = String(endLine).length;
        const formatted = selectedLines
          .map((line, i) => {
            const lineNum = String(startLine + i).padStart(maxLineNumWidth, ' ');
            // Truncate very long lines
            const truncatedLine = line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) + '...(truncated)' : line;
            return `${lineNum}\t${truncatedLine}`;
          })
          .join('\n');

        let header = `File: ${absolutePath}`;
        if (lines.length > endLine) {
          header += ` (showing lines ${startLine}-${endLine} of ${lines.length})`;
        }

        return { content: `${header}\n${formatted}` };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: `Error reading file ${absolutePath}: ${msg}`, isError: true };
      }
    },
  };
}

/**
 * SSH File Write Tool
 * Writes files to remote server via SFTP
 */
export function createSshFileWriteTool(getSshTerminalId: SshIdArg): Tool {
  return {
    name: 'file_write',
    description: 'Write content to a file on the remote server. Creates the file if it does not exist, or overwrites it if it does. Also creates parent directories if needed.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to write (absolute or relative to working directory)',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
      },
      required: ['file_path', 'content'],
    },

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const filePath = params.file_path as string;
      const content = params.content as string;

      const sshTerminalId = resolveSshId(getSshTerminalId);
      if (!sshTerminalId) {
        return { content: 'Error: SSH 未连接。请先在"远程"面板中连接到 SSH 服务器。', isError: true };
      }

      const absolutePath = resolveRemotePath(filePath, sshTerminalId, context);

      try {
        const sftp = getSftpSession(sshTerminalId);
        if (!sftp) {
          return {
            content: `Error: No SFTP session available for terminal ${sshTerminalId}`,
            isError: true,
          };
        }

        // Ensure parent directory exists (via SSH mkdir command)
        const parentDir = dirname(absolutePath);
        await new Promise<void>((resolve, reject) => {
          sftp.mkdir(parentDir, (err: Error | null | undefined) => {
            if (err) {
              // mkdir might fail if directory already exists, which is fine
              if (err.message.includes('exists')) {
                resolve();
              } else {
                reject(err);
              }
            } else {
              resolve();
            }
          });
        });

        await new Promise<void>((resolve, reject) => {
          sftp.writeFile(absolutePath, Buffer.from(content, 'utf8'), (err: Error | null | undefined) => {
            if (err) return reject(err);
            resolve();
          });
        });

        const lineCount = content.split('\n').length;
        return { content: `Successfully wrote ${lineCount} lines to ${absolutePath}` };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: `Error writing file ${absolutePath}: ${msg}`, isError: true };
      }
    },
  };
}

/**
 * SSH File Edit Tool
 * Performs exact string replacements in files on remote server via SFTP
 */
export function createSshFileEditTool(getSshTerminalId: SshIdArg): Tool {
  return {
    name: 'file_edit',
    description: 'Perform exact string replacements in files on the remote server. The old_string must match exactly (including whitespace and indentation). If replace_all is true, replaces all occurrences; otherwise only works if old_string is unique in the file.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to edit',
        },
        old_string: {
          type: 'string',
          description: 'The exact text to find and replace',
        },
        new_string: {
          type: 'string',
          description: 'The replacement text',
        },
        replace_all: {
          type: 'boolean',
          description: 'If true, replace all occurrences. Default: false',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const filePath = params.file_path as string;
      const oldString = params.old_string as string;
      const newString = params.new_string as string;
      const replaceAll = (params.replace_all as boolean) ?? false;

      const sshTerminalId = resolveSshId(getSshTerminalId);
      if (!sshTerminalId) {
        return { content: 'Error: SSH 未连接。请先在"远程"面板中连接到 SSH 服务器。', isError: true };
      }

      const absolutePath = resolveRemotePath(filePath, sshTerminalId, context);

      try {
        const sftp = getSftpSession(sshTerminalId);
        if (!sftp) {
          return {
            content: `Error: No SFTP session available for terminal ${sshTerminalId}`,
            isError: true,
          };
        }

        // Read file content
        const content = await new Promise<string>((resolve, reject) => {
          sftp.readFile(absolutePath, (err: Error | null | undefined, data: Buffer) => {
            if (err) return reject(err);
            resolve(data.toString('utf8'));
          });
        });

        if (!content.includes(oldString)) {
          return {
            content: `Error: old_string not found in ${absolutePath}. Make sure the string matches exactly including whitespace.`,
            isError: true,
          };
        }

        if (!replaceAll) {
          // Check uniqueness
          const firstIdx = content.indexOf(oldString);
          const secondIdx = content.indexOf(oldString, firstIdx + 1);
          if (secondIdx !== -1) {
            const count = content.split(oldString).length - 1;
            return {
              content: `Error: old_string appears ${count} times in ${absolutePath}. Use replace_all: true to replace all occurrences, or provide more surrounding context to make it unique.`,
              isError: true,
            };
          }
        }

        let newContent: string;
        if (replaceAll) {
          newContent = content.split(oldString).join(newString);
        } else {
          newContent = content.replace(oldString, newString);
        }

        // Write updated content
        await new Promise<void>((resolve, reject) => {
          sftp.writeFile(absolutePath, Buffer.from(newContent, 'utf8'), (err: Error | null | undefined) => {
            if (err) return reject(err);
            resolve();
          });
        });

        const replacements = replaceAll ? content.split(oldString).length - 1 : 1;
        return { content: `Successfully made ${replacements} replacement(s) in ${absolutePath}` };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: `Error editing file ${absolutePath}: ${msg}`, isError: true };
      }
    },
  };
}
