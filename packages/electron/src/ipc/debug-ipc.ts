// Debug IPC handler — Node.js inspector integration
// Manages debug sessions via Chrome DevTools Protocol (CDP)

import { ipcMain, BrowserWindow, shell } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

// ── Types ──

export interface DebugConfig {
  name: string;
  type: 'node' | 'npm' | 'custom';
  program?: string;        // entry file for 'node' type
  cwd?: string;            // working directory
  args?: string[];         // extra arguments
  env?: Record<string, string>;
  runtimeExecutable?: string; // e.g. 'node', 'tsx', 'ts-node'
}

export interface DebugSession {
  id: string;
  config: DebugConfig;
  process: ChildProcess;
  inspectorPort: number;
  devtoolsUrl: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  createdAt: number;
}

export interface LaunchConfig {
  version: '0.1.0';
  configurations: DebugConfig[];
}

// ── State ──
const sessions = new Map<string, DebugSession>();
let nextPort = 9229;

// ── Config paths ──
const LINGJING_DIR = join(homedir(), '.lingjing');
const LAUNCH_PATH = join(LINGJING_DIR, 'launch.json');

function ensureDir(): void {
  if (!existsSync(LINGJING_DIR)) {
    mkdirSync(LINGJING_DIR, { recursive: true });
  }
}

// ── Launch config CRUD ──

export function loadLaunchConfig(): LaunchConfig {
  try {
    if (existsSync(LAUNCH_PATH)) {
      return JSON.parse(readFileSync(LAUNCH_PATH, 'utf8'));
    }
  } catch { /* ignore */ }
  return {
    version: '0.1.0',
    configurations: [
      { name: 'Node.js (当前文件)', type: 'node', program: '${file}' },
      { name: 'npm start', type: 'npm', args: ['start'] },
      { name: 'npm run dev', type: 'npm', args: ['run', 'dev'] },
    ],
  };
}

export function saveLaunchConfig(config: LaunchConfig): void {
  ensureDir();
  writeFileSync(LAUNCH_PATH, JSON.stringify(config, null, 2), 'utf8');
}

// ── Registration ──

export function registerDebugIpc(mainWindow: BrowserWindow): void {
  // ── Launch config ──
  ipcMain.handle('debug:get-config', async () => {
    return loadLaunchConfig();
  });

  ipcMain.handle('debug:save-config', async (_event, config: LaunchConfig) => {
    saveLaunchConfig(config);
    return { success: true };
  });

  // ── Start debug session ──
  ipcMain.handle('debug:start', async (_event, { config, workspacePath }: { config: DebugConfig; workspacePath?: string }) => {
    const id = randomUUID();
    const port = nextPort++;

    try {
      const cwd = config.cwd || workspacePath || process.cwd();
      const entryFile = (config.program || 'index.js').replace('${file}', 'index.js');
      const runtime = config.runtimeExecutable || 'node';
      const args = [runtime === 'node' ? `--inspect=${port}` : `--inspect=${port}`, entryFile, ...(config.args || [])];

      const proc = spawn(runtime, runtime === 'node' ? [`--inspect=${port}`, entryFile, ...(config.args || [])] : args, {
        cwd,
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: false,
      });

      const devtoolsUrl = `chrome-devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=127.0.0.1:${port}`;

      const session: DebugSession = {
        id,
        config,
        process: proc,
        inspectorPort: port,
        devtoolsUrl,
        status: 'starting',
        createdAt: Date.now(),
      };

      sessions.set(id, session);

      // Handle stdout/stderr
      proc.stdout?.on('data', (data: Buffer) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('debug:output', { sessionId: id, data: data.toString(), stream: 'stdout' });
        }
      });
      proc.stderr?.on('data', (data: Buffer) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('debug:output', { sessionId: id, data: data.toString(), stream: 'stderr' });
        }
      });

      // Detect inspector ready
      let inspectorReady = false;
      const readyTimeout = setTimeout(() => {
        if (!inspectorReady && sessions.has(id)) {
          const s = sessions.get(id)!;
          s.status = 'running'; // Assume running after timeout
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('debug:status', { sessionId: id, status: 'running', port });
          }
        }
      }, 3000);

      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes('Debugger listening on') || msg.includes('ws://')) {
          inspectorReady = true;
          clearTimeout(readyTimeout);
          session.status = 'running';
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('debug:status', { sessionId: id, status: 'running', port });
          }
        }
      });

      proc.on('exit', (code) => {
        clearTimeout(readyTimeout);
        session.status = 'stopped';
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('debug:status', { sessionId: id, status: 'stopped', exitCode: code });
        }
        sessions.delete(id);
      });

      proc.on('error', (err) => {
        session.status = 'error';
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('debug:status', { sessionId: id, status: 'error', error: err.message });
        }
        sessions.delete(id);
      });

      return { sessionId: id, port, devtoolsUrl };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Open DevTools ──
  ipcMain.handle('debug:open-devtools', async (_event, { sessionId }: { sessionId: string }) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return { error: 'Session not found' };
    }
    try {
      await shell.openExternal(session.devtoolsUrl);
      return { success: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Stop debug session ──
  ipcMain.handle('debug:stop', async (_event, { sessionId }: { sessionId: string }) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return { error: 'Session not found' };
    }
    try {
      session.process.kill('SIGTERM');
      // Force kill after 5s
      setTimeout(() => {
        try { session.process.kill('SIGKILL'); } catch {}
      }, 5000);
      sessions.delete(sessionId);
      return { success: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── List sessions ──
  ipcMain.handle('debug:list', async () => {
    return Array.from(sessions.values()).map(s => ({
      id: s.id,
      configName: s.config.name,
      port: s.inspectorPort,
      status: s.status,
      createdAt: s.createdAt,
    }));
  });

  console.log('[Debug IPC] Registered debug:* handlers');
}
