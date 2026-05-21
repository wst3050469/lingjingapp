// SSH List Directory tool - list directory contents via SFTP, with local fallback

import type { Tool, ToolContext, ToolResult } from '@codepilot/core';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getSftpSession, getRemoteWorkspacePath } from '../ssh/session-manager.js';

type SshIdArg = string | (() => string | null);

function resolveSshId(arg: SshIdArg): string | null {
  return typeof arg === 'function' ? arg() : arg;
}

function resolveRemoteDirPath(dirPath: string, sshTerminalId: string, context: ToolContext): string {
  if (dirPath.startsWith('/')) return dirPath;
  if (/^[a-zA-Z]:[\\/]/.test(dirPath)) return dirPath;

  const remotePath = getRemoteWorkspacePath(sshTerminalId);
  if (remotePath) {
    const normalizedBase = remotePath.endsWith('/') ? remotePath.slice(0, -1) : remotePath;
    const normalizedDir = dirPath.startsWith('./') ? dirPath.slice(2) : dirPath;
    return `${normalizedBase}/${normalizedDir}`;
  }
  return resolve(context.workingDirectory, dirPath);
}

function resolveLocalDirPath(dirPath: string, context: ToolContext): string {
  if (dirPath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(dirPath)) return dirPath;
  return resolve(context.workingDirectory, dirPath);
}

export function createSshListDirTool(getSshTerminalId: SshIdArg): Tool {
  return {
    name: 'list_dir',
    description: 'List directory contents with file/folder structure and file sizes. When SSH is connected, lists remote directory; otherwise lists local directory.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path (absolute or relative to workspace)',
        },
      },
      required: ['path'],
    },

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const dirPath = params.path as string;
      if (!dirPath) {
        return { content: 'Error: Missing required parameter "path"', isError: true };
      }

      const sshTerminalId = resolveSshId(getSshTerminalId);
      let absolutePath = dirPath;

      try {
        if (sshTerminalId) {
          // === SSH execution ===
          absolutePath = resolveRemoteDirPath(dirPath, sshTerminalId, context);
          const sftp = getSftpSession(sshTerminalId);
          if (!sftp) {
            return { content: `Error: No SFTP session available for terminal ${sshTerminalId}`, isError: true };
          }

          const entries = await new Promise<Array<{ filename: string; longname: string }>>((resolveList, reject) => {
            sftp.readdir(absolutePath, (err: Error | null | undefined, list: Array<{ filename: string; longname: string }>) => {
              if (err) return reject(err);
              resolveList(list || []);
            });
          });

          // Format output similarly to `ls -la`
          const lines = entries.map((entry) => {
            const isDir = entry.longname?.startsWith('d') ?? false;
            const icon = isDir ? '📁' : '📄';
            // Extract file size from longname
            const parts = entry.longname?.split(/\s+/) ?? [];
            const size = parts[4] ?? '';
            return `${icon} ${entry.filename} (${isDir ? 'dir' : `file, ${size}B`})`;
          });

          return { content: `Directory: ${absolutePath}\n${lines.join('\n') || '(empty)'}` };
        } else {
          // === Local fallback ===
          absolutePath = resolveLocalDirPath(dirPath, context);
          const entries = await readdir(absolutePath, { withFileTypes: true });

          const lines: string[] = [];
          for (const entry of entries) {
            const isDir = entry.isDirectory();
            const icon = isDir ? '📁' : '📄';
            let sizeStr = '';
            if (!isDir) {
              try {
                const fileStat = await stat(resolve(absolutePath, entry.name));
                sizeStr = `, ${fileStat.size}B`;
              } catch {
                // ignore stat errors
              }
            }
            lines.push(`${icon} ${entry.name} (${isDir ? 'dir' : `file${sizeStr}`})`);
          }

          return { content: `Directory: ${absolutePath}\n${lines.join('\n') || '(empty)'}` };
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: `Error listing directory ${absolutePath || dirPath}: ${msg}`, isError: true };
      }
    },
  };
}
