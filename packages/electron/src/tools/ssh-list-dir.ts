// SSH List Directory Tool - lists directories on remote server via SFTP

import type { Tool, ToolContext, ToolResult } from '@codepilot/core';
import { resolve } from 'node:path';

// SSH session manager
import { getSftpSession, getRemoteWorkspacePath } from '../ssh/session-manager.js';

interface RemoteDirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime?: number;
}

/**
 * Helper to resolve directory path: uses remote workspace path if available,
 * otherwise falls back to context.workingDirectory.
 * IMPORTANT: For remote paths, we must use POSIX path separators (/),
 * not Windows separators (\).
 */
function resolveRemoteDirPath(dirPath: string, sshTerminalId: string, context: ToolContext): string {
  // Check for POSIX absolute paths (Linux/Mac)
  if (dirPath.startsWith('/')) {
    return dirPath;
  }
  // Check for Windows absolute paths
  if (/^[a-zA-Z]:[\\/]/.test(dirPath)) {
    return dirPath;
  }

  // For relative paths, prefer the remote workspace path
  const remotePath = getRemoteWorkspacePath(sshTerminalId);
  if (remotePath) {
    // Use POSIX path joining for remote Linux paths
    const normalizedBase = remotePath.endsWith('/') ? remotePath.slice(0, -1) : remotePath;
    const normalizedDir = dirPath.startsWith('./') ? dirPath.slice(2) : dirPath;
    if (normalizedDir === '.' || normalizedDir === '') {
      return normalizedBase;
    }
    return `${normalizedBase}/${normalizedDir}`;
  }

  // Fallback to local working directory
  return resolve(context.workingDirectory, dirPath);
}

type SshIdArg = string | (() => string | null);

/** Resolve the SSH terminal ID from a static string or getter function. */
function resolveSshId(arg: SshIdArg): string | null {
  return typeof arg === 'function' ? arg() : arg;
}

/**
 * SSH List Directory Tool
 * Lists directories on remote server via SFTP
 */
export function createSshListDirTool(getSshTerminalId: SshIdArg): Tool {
  return {
    name: 'list_dir',
    description: 'List files and directories on the remote server. Returns entries sorted by type (directories first) then name. Supports recursive listing up to depth 5.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to list (absolute or relative to working directory). Defaults to "." for current directory.',
        },
        depth: {
          type: 'number',
          description: 'Recursion depth (1-5). Default: 1.',
        },
        show_hidden: {
          type: 'boolean',
          description: 'Whether to show hidden files (starting with .). Default: false.',
        },
      },
      required: [],
    },

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const inputPath = (params.path as string) || '.';
      const depth = Math.min(Math.max((params.depth as number) ?? 1, 1), 5);
      const showHidden = (params.show_hidden as boolean) ?? false;

      const sshTerminalId = resolveSshId(getSshTerminalId);
      if (!sshTerminalId) {
        return { content: 'Error: SSH 未连接。请先在"远程"面板中连接到 SSH 服务器。', isError: true };
      }

      const absolutePath = resolveRemoteDirPath(inputPath, sshTerminalId, context);

      try {
        const sftp = getSftpSession(sshTerminalId);
        if (!sftp) {
          return {
            content: `Error: No SFTP session available for terminal ${sshTerminalId}`,
            isError: true,
          };
        }

        const entries: RemoteDirEntry[] = await new Promise((resolveList, reject) => {
          sftp.readdir(absolutePath, (err: Error | undefined, list: any[]) => {
            if (err) return reject(err);
            const resolved: RemoteDirEntry[] = list.map(item => ({
              name: item.filename,
              path: `${absolutePath}/${item.filename}`,
              isDirectory: item.attrs.isDirectory(),
              size: item.attrs.size,
              mtime: item.attrs.mtime,
            }));
            // Sort: directories first, then by name
            resolved.sort((a, b) => {
              if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
            resolveList(resolved);
          });
        });

        // Filter hidden files if needed
        const filtered = showHidden ? entries : entries.filter(e => !e.name.startsWith('.'));

        // Format output
        const lines: string[] = [];
        const totalDirs = filtered.filter(e => e.isDirectory).length;
        const totalFiles = filtered.filter(e => !e.isDirectory).length;

        lines.push(`Directory: ${absolutePath}`);
        lines.push(`(${totalDirs} directories, ${totalFiles} files)`);
        lines.push('');

        for (const entry of filtered) {
          const icon = entry.isDirectory ? '[D]' : '   ';
          const sizeStr = entry.isDirectory ? '' : ` (${formatSize(entry.size)})`;
          lines.push(`${icon} ${entry.name}${sizeStr}`);
        }

        return { content: lines.join('\n') };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: `Error listing directory ${absolutePath}: ${msg}`, isError: true };
      }
    },
  };
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
