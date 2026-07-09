// FRP Client for reverse proxy
// Connects local web server to remote server for public access

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

interface FrpConfig {
  enabled: boolean;
  serverAddr: string;
  serverPort: number;
  token: string;
  localPort: number;
  remotePort: number;
  customDomain: string;
}

let frpProcess: ChildProcess | null = null;
let frpConfig: FrpConfig = {
  enabled: false,
  serverAddr: 'www.spiritrealmz.com',
  serverPort: 32200,
  token: '',
  localPort: 3001,
  remotePort: 8080,
  customDomain: 'www.spiritrealmz.com',
};

// Auto-reconnect state
let _autoReconnectTimer: NodeJS.Timeout | null = null;
let _reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 3000; // 3s, doubles each attempt

function getFrpDir(): string {
  const dir = path.join(app.getPath('userData'), 'frp');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getLogFile(): string {
  return path.join(getFrpDir(), 'frpc.log');
}

function logMsg(msg: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try {
    fs.appendFileSync(getLogFile(), line);
  } catch {
    // Ignore log write errors
  }
  console.log(msg);
}

// FRP config file path
function getFrpConfigPath(): string {
  return path.join(getFrpDir(), 'frpc.toml');
}

// Generate FRP config file (TOML format for frp v0.52+)
function generateFrpConfig(config: FrpConfig): string {
  const proxyType = config.customDomain ? 'http' : 'tcp';
  const proxyExtra = config.customDomain
    ? `customDomains = ["${config.customDomain}"]`
    : `remotePort = ${config.remotePort}`;

  return `# LingJing FRP config - auto-generated
serverAddr = "${config.serverAddr}"
serverPort = ${config.serverPort}
${config.token ? `auth.token = "${config.token}"` : ''}
loginFailExit = false

[[proxies]]
name = "lingjing-web"
type = "${proxyType}"
localPort = ${config.localPort}
${proxyExtra}
`;
}

export function startFrpClient(config: Partial<FrpConfig> = {}): void {
  if (frpProcess) {
    logMsg('[FRP] Client already running, pid: ' + frpProcess.pid);
    return;
  }

  // Cancel any pending auto-reconnect
  cancelAutoReconnect();

  frpConfig = { ...frpConfig, ...config };

  logMsg('[FRP] startFrpClient called');
  logMsg('[FRP] Config: ' + JSON.stringify(frpConfig));

  if (!frpConfig.enabled) {
    logMsg('[FRP] Not enabled, skipping');
    return;
  }

  // Generate config file
  const configPath = getFrpConfigPath();
  const configContent = generateFrpConfig(frpConfig);
  try {
    fs.writeFileSync(configPath, configContent);
    logMsg('[FRP] Config written to: ' + configPath);
  } catch (err: any) {
    logMsg('[FRP] Failed to write config: ' + err.message);
    return;
  }

  // Find frpc binary
  const frpcPath = findFrpcBinary();
  if (!frpcPath) {
    logMsg('[FRP] frpc binary not found');
    logMsg('[FRP]   Searched paths:');
    const allCandidates = buildCandidatePaths();
    for (const c of allCandidates) {
      logMsg('[FRP]     - ' + c);
    }
    return;
  }

  logMsg('[FRP] frpcPath: ' + frpcPath);
  logMsg('[FRP] configPath: ' + configPath);
  logMsg('[FRP] CWD: ' + path.dirname(frpcPath));
  logMsg('[FRP] process.cwd: ' + process.cwd());
  logMsg('[FRP] userData: ' + app.getPath('userData'));

  // Open log file for frpc stdout/stderr
  let logFd: number | null = null;
  try {
    logFd = fs.openSync(path.join(getFrpDir(), 'frpc_output.log'), 'a');
  } catch {
    logMsg('[FRP] Failed to open frpc output log');
  }

  // Start frpc process
  logMsg('[FRP] Spawning: ' + frpcPath + ' -c ' + configPath);
  try {
    const stdioOpt: any[] = ['pipe', 'pipe', 'pipe'];
    if (logFd !== null) {
      stdioOpt[1] = logFd; // stdout -> log file
      stdioOpt[2] = logFd; // stderr -> log file
    }

    frpProcess = spawn(frpcPath, ['-c', configPath], {
      cwd: path.dirname(frpcPath),
      stdio: stdioOpt as any,
      windowsHide: true,
      env: { ...process.env },
    });
    logMsg('[FRP] spawn() returned, pid: ' + (frpProcess?.pid ?? 'NULL'));
    logMsg('[FRP] frpProcess.killed: ' + frpProcess?.killed);

    // Reset reconnect counter on successful start
    _reconnectAttempts = 0;
  } catch (err: any) {
    logMsg('[FRP] spawn() threw: ' + err.message + ' stack: ' + err.stack);
    if (logFd !== null) {
      try { fs.closeSync(logFd); } catch {}
    }
    return;
  }

  frpProcess.stdout?.on('data', (data) => {
    console.log('[FRP]', data.toString().trim());
  });

  frpProcess.stderr?.on('data', (data) => {
    console.error('[FRP]', data.toString().trim());
  });

  frpProcess.on('close', (code, signal) => {
    logMsg('[FRP] Process exited, code: ' + code + ', signal: ' + signal);
    frpProcess = null;
    if (logFd !== null) {
      try { fs.closeSync(logFd); } catch {}
      logFd = null;
    }

    // Auto-reconnect on non-zero exit (unless we were intentionally stopped)
    if (code !== 0 && _reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      scheduleAutoReconnect();
    }
  });

  frpProcess.on('error', (err) => {
    logMsg('[FRP] Process error: ' + err.message);
    frpProcess = null;
    if (logFd !== null) {
      try { fs.closeSync(logFd); } catch {}
      logFd = null;
    }
  });
}

function scheduleAutoReconnect(): void {
  if (_autoReconnectTimer) return;

  _reconnectAttempts++;
  const delay = Math.min(
    RECONNECT_DELAY_BASE * Math.pow(2, _reconnectAttempts - 1),
    30000 // Cap at 30s
  );

  logMsg('[FRP] Auto-reconnect in ' + delay + 'ms (attempt ' + _reconnectAttempts + '/' + MAX_RECONNECT_ATTEMPTS + ')');

  _autoReconnectTimer = setTimeout(() => {
    _autoReconnectTimer = null;
    logMsg('[FRP] Auto-reconnect attempt ' + _reconnectAttempts + '/' + MAX_RECONNECT_ATTEMPTS);
    startFrpClient(frpConfig);
  }, delay);
}

function cancelAutoReconnect(): void {
  if (_autoReconnectTimer) {
    clearTimeout(_autoReconnectTimer);
    _autoReconnectTimer = null;
  }
  _reconnectAttempts = 0;
}

export function stopFrpClient(): void {
  cancelAutoReconnect();
  if (frpProcess) {
    const pid = frpProcess.pid;
    logMsg('[FRP] Stopping client, pid: ' + pid);
    frpProcess.kill();
    frpProcess = null;
    logMsg('[FRP] Client stopped');
  }
}

function buildCandidatePaths(): string[] {
  const candidates: string[] = [];

  // #1 Priority: User data directory (auto-copied on app start by main.ts -> ensureFrpcBinary)
  // This is the most reliable location because ensureFrpcBinary() copies frpc.exe here
  // on every app start from whichever source is available (packaged resources or dev dir).
  candidates.push(
    path.join(app.getPath('userData'), 'frp', 'frpc.exe'),
    path.join(app.getPath('userData'), 'frp', 'frpc'),
  );

  // #2 Priority: Packaged app extraResource at resources/frp/
  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'frp', 'frpc.exe'),
      path.join(process.resourcesPath, 'frp', 'frpc'),
    );
  }

  // #3 Priority: Dev mode paths (__dirname is dist/ after compilation)
  candidates.push(
    path.join(__dirname, '..', 'frp', 'frpc.exe'),
    path.join(__dirname, '..', '..', 'frp', 'frpc.exe'),
    path.join(__dirname, '..', '..', '..', '..', 'packages', 'electron', 'frp', 'frpc.exe'),
  );

  // #4 Priority: Current working directory
  candidates.push(
    path.join(process.cwd(), 'frp', 'frpc.exe'),
    path.join(process.cwd(), 'frp', 'frpc'),
  );

  // #5 Priority: Fallback - various relative paths
  candidates.push(
    path.join(process.cwd(), '..', '..', '..',  'packages', 'electron', 'frp', 'frpc.exe'),
  );

  return candidates;
}

function findFrpcBinary(): string | null {
  const candidates = buildCandidatePaths();

  logMsg('[FRP] Searching for frpc in candidates:');
  for (const candidate of candidates) {
    try {
      logMsg('[FRP]   Check: ' + candidate + ' exists=' + fs.existsSync(candidate));
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (err: any) {
      logMsg('[FRP]   Error checking ' + candidate + ': ' + err.message);
    }
  }

  return null;
}

export function getFrpStatus(): { running: boolean; config: FrpConfig } {
  return {
    running: frpProcess !== null && !frpProcess.killed,
    config: frpConfig,
  };
}
