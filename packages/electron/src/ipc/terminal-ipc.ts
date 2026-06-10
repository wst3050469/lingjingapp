// Terminal IPC handler — node-pty (Linux only) with child_process fallback
// node-pty provides true PTY support: resize, Ctrl+C, TUI apps, proper colors
// On Windows: always uses child_process (node-pty native module not compiled)

import { ipcMain, type BrowserWindow } from 'electron';
import { spawn, execSync } from 'node:child_process';
import { platform } from 'node:os';

interface PtyHandle {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (code: number) => void) => void;
  pid: number;
}

interface TerminalSession { id: string; pty: PtyHandle; }

const sessions = new Map<string, TerminalSession>();
let terminalCounter = 0;
const MAX_TERMINALS = 10;

// Lazily load node-pty — only on Linux, only when first terminal is created
// This avoids crashing on Windows where the native addon isn't compiled
let _ptyModule: any = null;
let _ptyChecked = false;

function getPtyModule(): any | null {
  if (_ptyChecked) return _ptyModule;
  _ptyChecked = true;
  if (platform() === 'win32') return null;
  try {
    const m = require('node-pty');
    console.log('[Terminal] node-pty loaded — PTY support enabled');
    _ptyModule = m;
  } catch (e) {
    console.warn('[Terminal] node-pty not available:', (e as Error).message);
  }
  return _ptyModule;
}

function killProcessTree(pid: number, signal: NodeJS.Signals = 'SIGTERM'): void {
  const isWin = platform() === 'win32';
  try {
    if (isWin) {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', timeout: 3000 });
    } else {
      process.kill(-pid, signal);
    }
  } catch { /* already dead */ }
}

export function registerTerminalIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle('terminal:create', async (_event, { cwd, command }: { cwd?: string; command?: string }) => {
    if (sessions.size >= MAX_TERMINALS) {
      return { terminalId: '', error: `已达到最大终端数限制 (${MAX_TERMINALS})` };
    }

    const id = `term-${++terminalCounter}`;
    const isWin = platform() === 'win32';

    try {
      // Try loading pty module lazily (succeeds on Linux, fails fast on Windows)
      const ptyMod = getPtyModule();

      if (ptyMod) {
        // ── node-pty path (Linux) ──
        const shell = process.env.SHELL || '/bin/bash';
        const pty = ptyMod.spawn(shell, [], {
          name: 'xterm-256color',
          cols: 80, rows: 24,
          cwd: cwd || process.cwd(),
          env: { ...process.env, TERM: 'xterm-256color' },
        });

        const handle: PtyHandle = {
          write: (d: string) => pty.write(d),
          resize: (c: number, r: number) => pty.resize(c, r),
          kill: (s?: string) => { try { pty.kill(s); kilProcessTree(pty.pid, 'SIGTERM'); } catch {} },
          onData: (cb) => pty.onData(cb),
          onExit: (cb) => pty.onExit((e: { exitCode: number }) => cb(e.exitCode)),
          pid: pty.pid,
        };

        handle.onData((data: string) => {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('terminal:data', { terminalId: id, data });
          }
        });
        handle.onExit((code: number) => {
          sessions.delete(id);
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('terminal:data', { terminalId: id, data: `\r\n[Process exited with code ${code}]\r\n` });
          }
        });

        sessions.set(id, { id, pty: handle });
        if (command) handle.write(command + '\n');
        return { terminalId: id, pty: true };
      }

      // ── child_process fallback (Windows / no pty) ──
      const shell = isWin ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
      const shellArgs = isWin
        ? ['-NoLogo', '-NoProfile', '-NoExit', '-Command', '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8']
        : [];

      const proc = spawn(shell, shellArgs, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, TERM: 'xterm-256color' },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        detached: true,
      });

      let spawnError: Error | null = null;
      proc.on('error', (err) => { spawnError = err; sessions.delete(id); });

      const handle: PtyHandle = {
        write: (d: string) => { proc.stdin?.write(d); },
        resize: () => {},
        kill: () => { if (proc.pid) killProcessTree(proc.pid); },
        onData: (cb) => {
          proc.stdout?.on('data', (d: Buffer) => cb(d.toString()));
          proc.stderr?.on('data', (d: Buffer) => cb(d.toString()));
        },
        onExit: (cb) => { proc.on('exit', (c) => cb(c ?? -1)); },
        pid: proc.pid ?? 0,
      };

      sessions.set(id, { id, pty: handle });

      handle.onData((data: string) => {
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:data', { terminalId: id, data });
      });
      handle.onExit((code) => {
        sessions.delete(id);
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:data', { terminalId: id, data: `\r\n[Process exited with code ${code}]\r\n` });
      });

      await new Promise(r => setTimeout(r, 50));
      if (spawnError) return { terminalId: id, error: (spawnError as Error).message };
      if (command && proc.stdin?.writable) proc.stdin.write(command + '\n');

      return { terminalId: id, pty: false };
    } catch (err) {
      sessions.delete(id);
      return { terminalId: id, error: String(err) };
    }
  });

  ipcMain.handle('terminal:input', (_e, { terminalId, data }: { terminalId: string; data: string }) => {
    const s = sessions.get(terminalId);
    if (s) s.pty.write(data);
  });

  ipcMain.handle('terminal:resize', (_e, { terminalId, cols, rows }: { terminalId: string; cols: number; rows: number }) => {
    const s = sessions.get(terminalId);
    if (s) s.pty.resize(cols, rows);
  });

  ipcMain.handle('terminal:destroy', (_e, { terminalId }: { terminalId: string }) => {
    const s = sessions.get(terminalId);
    if (s) { s.pty.kill(); sessions.delete(terminalId); }
  });
}

export function destroyAllTerminals(): void {
  for (const s of sessions.values()) s.pty.kill();
  sessions.clear();
}

// Fix typo in helper function name used inside node-pty path
function kilProcessTree(pid: number, sig?: string): void {
  killProcessTree(pid, sig as NodeJS.Signals);
}
