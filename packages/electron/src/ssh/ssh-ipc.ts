// SSH IPC handlers - bridges renderer to ssh2 library

import { ipcMain, BrowserWindow } from 'electron';
import { Client } from 'ssh2';
import type { ClientChannel, SFTPWrapper } from 'ssh2';
import { v4 as uuidv4 } from 'uuid';
import {
  loadConnections,
  saveConnection,
  deleteConnection,
  getConnectionWithCredentials,
  updateConnectionStatus,
} from './connection-store.js';
import { decryptCredential } from './crypto.js';
import type { SSHConnection, SSHConnectionForm, SSHSession, RemoteFileEntry, RemoteFileStat } from './types.js';
import { extname } from 'path';
import { registerSshSessions } from './session-manager.js';

// Callback for notifying SSH terminal changes to agent
let onSshTerminalChange: ((sshTerminalId: string | null) => void) | null = null;

export function setSshTerminalChangeCallback(callback: (sshTerminalId: string | null) => void): void {
  onSshTerminalChange = callback;
}

const sshSessions = new Map<string, SSHSession>();

// Language detection helper (mirrors fs-ipc.ts logic)
function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescriptreact', '.js': 'javascript', '.jsx': 'javascriptreact',
    '.py': 'python', '.java': 'java', '.go': 'go', '.rs': 'rust', '.c': 'c', '.cpp': 'cpp',
    '.h': 'c', '.hpp': 'cpp', '.cs': 'csharp', '.rb': 'ruby', '.php': 'php', '.swift': 'swift',
    '.kt': 'kotlin', '.scala': 'scala', '.html': 'html', '.css': 'css', '.scss': 'scss',
    '.json': 'json', '.md': 'markdown', '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
    '.yml': 'yaml', '.yaml': 'yaml', '.xml': 'xml', '.sql': 'sql', '.r': 'r', '.lua': 'lua',
    '.toml': 'toml', '.ini': 'ini', '.cfg': 'ini', '.conf': 'ini',
  };
  return langMap[ext] || 'plaintext';
}

/**
 * Register window-independent SSH IPC handlers (safe to call before window creation).
 * These handlers don't need mainWindow — they only read/write database and SSH sessions.
 */
function registerWindowIndependentHandlers(): void {
  ipcMain.handle('ssh:list-connections', async (): Promise<SSHConnection[]> => {
    return await loadConnections();
  });

  // Save or update a connection
  ipcMain.handle('ssh:save-connection', async (_event, form: SSHConnectionForm): Promise<SSHConnection> => {
    return await saveConnection(form);
  });

  // Delete a connection
  ipcMain.handle('ssh:delete-connection', async (_event, { id }: { id: string }): Promise<void> => {
    // Disconnect if currently connected
    for (const [sessionId, session] of sshSessions.entries()) {
      if (session.connectionId === id) {
        await disconnectSession(sessionId);
      }
    }
    await deleteConnection(id);
  });

  // Test connection without saving
  ipcMain.handle('ssh:test-connection', async (_event, form: SSHConnectionForm): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, error: '连接超时' });
      }, 10000);

      client.on('ready', () => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: true });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: false, error: err.message });
      });

      const config: any = {
        host: form.host,
        port: form.port,
        username: form.username,
      };

      if (form.authMethod === 'password') {
        config.password = form.password;
      } else if (form.authMethod === 'privateKey' && form.privateKey) {
        config.privateKey = form.privateKey;
      }

      client.connect(config);
    });
  });
}

/** Register window-independent SSH IPC handlers for Phase A registration. */
export function registerSshIpcWindowIndependent(): void {
  registerSshSessions(sshSessions);
  registerWindowIndependentHandlers();
}

export function registerSshIpc(mainWindow: BrowserWindow): void {
  // Register SSH sessions for access by file tools
  registerSshSessions(sshSessions);
  
  // Register window-independent handlers (idempotent, safe to call twice)
  registerWindowIndependentHandlers();

ipcMain.handle('ssh:connect', async (_event, { connectionId }: { connectionId: string }): Promise<{ sshTerminalId: string; name: string; host: string; username: string }> => {
    const connection = await getConnectionWithCredentials(connectionId);
    if (!connection) {
      throw new Error('连接不存在');
    }

    await updateConnectionStatus(connectionId, 'connecting');

    return new Promise((resolve, reject) => {
      const client = new Client();
      const sshTerminalId = `ssh-term-${uuidv4()}`;

      const config: any = {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
      };

      // Decrypt and set authentication
      if (connection.authMethod === 'password' && connection.passwordEncrypted) {
        config.password = decryptCredential(connection.passwordEncrypted);
      } else if (connection.authMethod === 'privateKey' && connection.privateKeyEncrypted) {
        config.privateKey = decryptCredential(connection.privateKeyEncrypted);
      }

      client.on('ready', () => {
        // Open shell
        client.shell({
          term: 'xterm-256color',
          cols: 80,
          rows: 24,
        }, (err: Error | undefined, stream: ClientChannel) => {
          if (err) {
            client.end();
            reject(err);
            return;
          }

          const session: SSHSession = {
            id: sshTerminalId,
            connectionId,
            client,
            shell: stream,
            name: connection.name,
            host: connection.host,
            username: connection.username,
          };

          sshSessions.set(sshTerminalId, session);

          // Initialize SFTP for file operations - wait for it before resolving
          client.sftp((sftpErr: Error | undefined, sftp: SFTPWrapper | undefined) => {
            if (sftpErr) {
              console.warn('[SSH] SFTP initialization failed:', sftpErr);
            } else if (sftp) {
              session.sftp = sftp;
              console.log('[SSH] SFTP initialized for session:', sshTerminalId);
            }
            
            // Now resolve the connection promise (SFTP is ready or failed)
            updateConnectionStatus(connectionId, 'connected');
            
            // Notify agent of new SSH terminal
            if (onSshTerminalChange) {
              onSshTerminalChange(sshTerminalId);
            }
            
            resolve({
              sshTerminalId,
              name: connection.name,
              host: connection.host,
              username: connection.username,
            });
          });

          // Forward stdout to renderer
          stream.on('data', (data: Buffer) => {
            if (!mainWindow.isDestroyed() && mainWindow.webContents) {
              mainWindow.webContents.send('ssh:terminal-data', {
                sshTerminalId,
                data: data.toString('utf8'),
              });
            }
          });

          stream.stderr.on('data', (data: Buffer) => {
            if (!mainWindow.isDestroyed() && mainWindow.webContents) {
              mainWindow.webContents.send('ssh:terminal-data', {
                sshTerminalId,
                data: data.toString('utf8'),
              });
            }
          });

          stream.on('close', () => {
            // Shell closed — but the SSH client may still be alive.
            // Keep the session in sshSessions so executeSshCommand (client.exec)
            // can still run commands. Only null out the shell reference.
            if (session) {
              session.shell = null as any;
              console.log('[SSH] Shell stream closed, but keeping client alive for exec(). Session:', sshTerminalId);
            }
            if (!mainWindow.isDestroyed() && mainWindow.webContents) {
              mainWindow.webContents.send('ssh:terminal-closed', { sshTerminalId });
            }
            // Don't delete session or update status here — client.on('end') handles that.
          });
        });
      });

      client.on('error', (err) => {
        console.error('[SSH] Client error:', err.message, 'Session:', sshTerminalId);
        sshSessions.delete(sshTerminalId);
        updateConnectionStatus(connectionId, 'disconnected');
        // Notify agent that SSH terminal is gone
        if (onSshTerminalChange) {
          onSshTerminalChange(null);
        }
        if (!mainWindow.isDestroyed() && mainWindow.webContents) {
          mainWindow.webContents.send('ssh:terminal-closed', { sshTerminalId });
        }
        reject(new Error(`SSH 连接失败: ${err.message}`));
      });

      client.on('end', () => {
        console.log('[SSH] Client disconnected. Session:', sshTerminalId);
        sshSessions.delete(sshTerminalId);
        updateConnectionStatus(connectionId, 'disconnected');
        // Notify agent that SSH terminal is gone
        if (onSshTerminalChange) {
          onSshTerminalChange(null);
        }
        if (!mainWindow.isDestroyed() && mainWindow.webContents) {
          mainWindow.webContents.send('ssh:terminal-closed', { sshTerminalId });
        }
      });

      client.connect(config);
    });
  });

  // Disconnect SSH session
  ipcMain.handle('ssh:disconnect', async (_event, { sshTerminalId }: { sshTerminalId: string }): Promise<void> => {
    await disconnectSession(sshTerminalId);
  });

  // Send input to SSH shell
  ipcMain.handle('ssh:terminal-input', async (_event, { sshTerminalId, data }: { sshTerminalId: string; data: string }): Promise<void> => {
    const session = sshSessions.get(sshTerminalId);
    if (session && session.shell) {
      session.shell.write(data);
    }
  });

  // Resize SSH terminal
  ipcMain.handle('ssh:terminal-resize', async (_event, { sshTerminalId, cols, rows }: { sshTerminalId: string; cols: number; rows: number }): Promise<void> => {
    const session = sshSessions.get(sshTerminalId);
    if (session && session.shell) {
      (session.shell as any).setWindow?.(cols, rows);
    }
  });

  // ==================== Remote File Operations (SFTP) ====================

  // List remote directory
  ipcMain.handle('ssh:read-dir', async (_event, { sshTerminalId, path }: { sshTerminalId: string; path: string }): Promise<RemoteFileEntry[]> => {
    const session = sshSessions.get(sshTerminalId);
    if (!session?.sftp) throw new Error('SFTP 未连接');

    return new Promise((resolve, reject) => {
      session.sftp!.readdir(path, (err: Error | undefined, list: any[]) => {
        if (err) return reject(err);
        const entries: RemoteFileEntry[] = list.map(item => ({
          name: item.filename,
          path: `${path}/${item.filename}`,
          isDirectory: item.attrs.isDirectory(),
          size: item.attrs.size,
          mtime: item.attrs.mtime,
        }));
        entries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        resolve(entries);
      });
    });
  });

  // Read remote file
  ipcMain.handle('ssh:read-file', async (_event, { sshTerminalId, path }: { sshTerminalId: string; path: string }): Promise<{ content: string; language: string }> => {
    const session = sshSessions.get(sshTerminalId);
    if (!session?.sftp) throw new Error('SFTP 未连接');

    return new Promise((resolve, reject) => {
      session.sftp!.readFile(path, (err: Error | undefined, data: Buffer) => {
        if (err) return reject(err);
        const content = data.toString('utf8');
        const language = detectLanguage(path);
        resolve({ content, language });
      });
    });
  });

  // Write remote file
  ipcMain.handle('ssh:write-file', async (_event, { sshTerminalId, path, content }: { sshTerminalId: string; path: string; content: string }): Promise<void> => {
    const session = sshSessions.get(sshTerminalId);
    if (!session?.sftp) throw new Error('SFTP 未连接');

    return new Promise((resolve, reject) => {
      session.sftp!.writeFile(path, Buffer.from(content, 'utf8'), (err: Error | null | undefined) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  // Get remote file stat
  ipcMain.handle('ssh:stat', async (_event, { sshTerminalId, path }: { sshTerminalId: string; path: string }): Promise<RemoteFileStat> => {
    const session = sshSessions.get(sshTerminalId);
    if (!session?.sftp) throw new Error('SFTP 未连接');

    return new Promise((resolve, reject) => {
      session.sftp!.stat(path, (err: Error | null | undefined, stats: any) => {
        if (err) return reject(err);
        resolve({
          path,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          mtime: stats.mtime,
          permissions: stats.permissions?.toString(8) || '',
        });
      });
    });
  });

  // Create remote directory
  ipcMain.handle('ssh:mkdir', async (_event, { sshTerminalId, path }: { sshTerminalId: string; path: string }): Promise<void> => {
    const session = sshSessions.get(sshTerminalId);
    if (!session?.sftp) throw new Error('SFTP 未连接');

    return new Promise((resolve, reject) => {
      session.sftp!.mkdir(path, (err: Error | null | undefined) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  // Delete remote file or directory
  ipcMain.handle('ssh:delete', async (_event, { sshTerminalId, path }: { sshTerminalId: string; path: string }): Promise<void> => {
    const session = sshSessions.get(sshTerminalId);
    if (!session?.sftp) throw new Error('SFTP 未连接');

    return new Promise((resolve, reject) => {
      session.sftp!.stat(path, (err: Error | null | undefined, stats: any) => {
        if (err) return reject(err);
        if (stats.isDirectory()) {
          session.sftp!.rmdir(path, (rmdirErr: Error | null | undefined) => {
            if (rmdirErr) return reject(rmdirErr);
            resolve();
          });
        } else {
          session.sftp!.unlink(path, (unlinkErr: Error | null | undefined) => {
            if (unlinkErr) return reject(unlinkErr);
            resolve();
          });
        }
      });
    });
  });

  // Rename/move remote file or directory
  ipcMain.handle('ssh:rename', async (_event, { sshTerminalId, oldPath, newPath }: { sshTerminalId: string; oldPath: string; newPath: string }): Promise<void> => {
    const session = sshSessions.get(sshTerminalId);
    if (!session?.sftp) throw new Error('SFTP 未连接');

    return new Promise((resolve, reject) => {
      session.sftp!.rename(oldPath, newPath, (err: Error | null | undefined) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  // Set remote workspace path
  ipcMain.handle('ssh:set-workspace', async (_event, { sshTerminalId, path }: { sshTerminalId: string; path: string }): Promise<void> => {
    const session = sshSessions.get(sshTerminalId);
    if (!session) throw new Error('会话不存在');
    session.remoteWorkspacePath = path;
    console.log('[SSH] Remote workspace set:', path);
  });

  // Get remote workspace path
  ipcMain.handle('ssh:get-workspace', async (_event, { sshTerminalId }: { sshTerminalId: string }): Promise<{ path?: string }> => {
    const session = sshSessions.get(sshTerminalId);
    return { path: session?.remoteWorkspacePath };
  });

  // Execute a single command on remote server (non-interactive)
  ipcMain.handle('ssh:exec', async (_event, { sshTerminalId, command, cwd }: { sshTerminalId: string; command: string; cwd?: string }): Promise<{ stdout: string; stderr: string; exitCode: number | null }> => {
    const session = sshSessions.get(sshTerminalId);
    if (!session?.client) throw new Error('SSH 未连接');

    return new Promise((resolve, reject) => {
      // Use exec() for single command execution
      session.client.exec(command, { pty: false }, (err, stream) => {
        if (err) return reject(err);

        let stdout = '';
        let stderr = '';

        stream.on('close', (code: number) => {
          resolve({ stdout, stderr, exitCode: code ?? null });
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('error', (error: Error) => {
          reject(error);
        });
      });
    });
  });
}

async function disconnectSession(sshTerminalId: string): Promise<void> {
  const session = sshSessions.get(sshTerminalId);
  if (session) {
    try {
      if (session.shell) session.shell.end();
      if (session.sftp) session.sftp.end();
      session.client.end();
    } catch (err) {
      console.error('[SSH] Disconnect error:', err);
    }
    sshSessions.delete(sshTerminalId);
    await updateConnectionStatus(session.connectionId, 'disconnected');
    
    // Notify agent that SSH terminal is gone
    if (onSshTerminalChange) {
      onSshTerminalChange(null);
    }
  }
}

export function destroyAllSshSessions(): void {
  for (const [id, session] of sshSessions.entries()) {
    try {
      session.client.end();
    } catch {
      // Ignore errors during cleanup
    }
  }
  sshSessions.clear();
}

// Execute a command on remote server via SSH (for use by tools in main process)
export async function executeSshCommand(
  sshTerminalId: string,
  command: string,
  timeout: number = 120_000,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const session = sshSessions.get(sshTerminalId);
  if (!session?.client) throw new Error('SSH 未连接');

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Command timed out'));
    }, timeout);

    session.client.exec(command, { pty: false }, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return reject(err);
      }

      let stdout = '';
      let stderr = '';

      stream.on('close', (code: number) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? null });
      });

      stream.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on('error', (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  });
}
