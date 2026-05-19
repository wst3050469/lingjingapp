// Terminal IPC handler - uses child_process to provide shell sessions
// Falls back to child_process.spawn since node-pty requires native compilation

import { ipcMain, type BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { platform } from 'node:os';

interface TerminalSession {
  id: string;
  process: ChildProcess;
}

const sessions = new Map<string, TerminalSession>();
let terminalCounter = 0;

export function registerTerminalIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle('terminal:create', async (_event, { cwd, command }: { cwd?: string; command?: string }) => {
    const id = `term-${++terminalCounter}`;

    try {
      const isWin = platform() === 'win32';
      const shell = isWin ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
      const shellArgs = isWin
        ? ['-NoLogo', '-NoProfile', '-NoExit', '-Command', '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8']
        : [];

      const proc = spawn(shell, shellArgs, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, TERM: 'xterm-256color' },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      sessions.set(id, { id, process: proc });

      proc.stdout?.on('data', (data: Buffer) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:data', {
            terminalId: id,
            data: data.toString(),
          });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:data', {
            terminalId: id,
            data: data.toString(),
          });
        }
      });

      proc.on('exit', (code) => {
        sessions.delete(id);
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:data', {
            terminalId: id,
            data: `\r\n[Process exited with code ${code}]\r\n`,
          });
        }
      });

      if (command) {
        proc.stdin?.write(command + '\n');
      }

      return { terminalId: id };
    } catch (err) {
      sessions.delete(id);
      console.error('[Terminal] Failed to create terminal:', err);
      return { terminalId: id, error: String(err) };
    }
  });

  ipcMain.handle('terminal:input', async (_event, { terminalId, data }: { terminalId: string; data: string }) => {
    const session = sessions.get(terminalId);
    if (session?.process.stdin?.writable) {
      session.process.stdin.write(data);
    }
  });

  ipcMain.handle('terminal:resize', async (_event, { terminalId, cols, rows }: { terminalId: string; cols: number; rows: number }) => {
    // child_process doesn't support resize natively
    // This is a no-op until we switch to node-pty
  });

  ipcMain.handle('terminal:destroy', async (_event, { terminalId }: { terminalId: string }) => {
    const session = sessions.get(terminalId);
    if (session) {
      session.process.kill();
      sessions.delete(terminalId);
    }
  });
}

// Cleanup all terminal sessions
export function destroyAllTerminals(): void {
  for (const session of sessions.values()) {
    session.process.kill();
  }
  sessions.clear();
}
