// IPC Handler Registration Verifier
// Startup self-check: verifies critical IPC handlers are registered after startup
// If any are missing, writes diagnostic info to ~/.lingjing/startup-error.log
import { ipcMain, app } from 'electron';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Critical IPC handlers that must be registered for normal operation
const CRITICAL_HANDLERS: string[] = [
  // SSH
  'ssh:list-connections',
  'ssh:connect',
  'ssh:disconnect',
  'ssh:exec',
  // Cloud
  'cloud:connect',
  'cloud:disconnect',
  'cloud:status',
  'cloud:proxy-api',
  // Config
  'config:get',
  'config:set',
  // Update
  'update:check',
  'update:download',
  'update:install',
  // Agent
  'agent:run',
  'agent:abort',
  // Quest
  'quest:run',
  'quest:abort',
  // Filesystem
  'fs:read-dir',
  'fs:read-file',
  'fs:write-file',
  // Terminal
  'terminal:create',
  'terminal:input',
  // Network
  'network:diagnose',
];

const LOG_FILE = join(homedir(), '.lingjing', 'startup-error.log');

function ensureLogDir(): void {
  try {
    mkdirSync(join(homedir(), '.lingjing'), { recursive: true });
  } catch {
    // Ignore mkdir errors
  }
}

function writeLog(message: string): void {
  ensureLogDir();
  try {
    writeFileSync(LOG_FILE, message, { encoding: 'utf-8', flag: 'w' });
  } catch {
    console.error('[IPC-Verifier] Failed to write log:', LOG_FILE);
  }
}

/**
 * Verify that all critical IPC handlers are properly registered.
 *
 * Uses ipcMain.listenerCount('handle-<channel>') which returns 1 if
 * ipcMain.handle(channel, ...) was called for that channel.
 *
 * @returns Array of missing handler names
 */
export function verifyIpcRegistrations(): string[] {
  const missing: string[] = [];

  for (const channel of CRITICAL_HANDLERS) {
    // ipcMain.handle() registers a listener on the internal 'handle-<channel>' event
    const listenerCount = ipcMain.listenerCount(`handle-${channel}`);
    if (listenerCount === 0) {
      missing.push(channel);
    }
  }

  if (missing.length > 0) {
    const timestamp = new Date().toISOString();
    const appVersion = app.getVersion();
    const logMessage = [
      `=== IPC Registration Check Failed ===`,
      `Time: ${timestamp}`,
      `App Version: ${appVersion}`,
      `Missing Handlers (${missing.length}/${CRITICAL_HANDLERS.length}):`,
      ...missing.map((ch) => `  - ${ch}`),
      ``,
      `This means the following features will NOT work:`,
      ...generateFeatureDescriptions(missing),
      ``,
      `Possible causes:`,
      `  1. Outdated dist/main.js — reinstall the latest version`,
      `  2. Build process issue — ensure 'pnpm build' completed successfully`,
      `  3. Module loading error — check DevTools console for syntax errors`,
      `================================`,
    ].join('\n');

    writeLog(logMessage);
    console.error(`[IPC-Verifier] ${missing.length} critical handlers missing. See ${LOG_FILE}`);
  } else {
    // All handlers registered — clear any previous error log if it exists
    try {
      if (existsSync(LOG_FILE)) {
        writeLog(''); // Clear the log on successful startup
      }
    } catch {
      // Ignore
    }
    console.log(`[IPC-Verifier] All ${CRITICAL_HANDLERS.length} critical handlers registered ✅`);
  }

  return missing;
}

function generateFeatureDescriptions(missing: string[]): string[] {
  const featureMap: Record<string, string> = {
    'ssh:list-connections': 'Remote Explorer — SSH connections',
    'ssh:connect': 'Remote Explorer — SSH connect',
    'ssh:disconnect': 'Remote Explorer — SSH disconnect',
    'ssh:exec': 'Remote Explorer — execute command',
    'cloud:connect': 'Cloud Sync — connect',
    'cloud:disconnect': 'Cloud Sync — disconnect',
    'cloud:status': 'Cloud Sync — status check',
    'config:get': 'Settings — load configuration',
    'config:set': 'Settings — save configuration',
    'update:check': 'Update — check for updates',
    'update:download': 'Update — download update',
    'update:install': 'Update — install update',
    'agent:run': 'AI Agent — run message',
    'agent:abort': 'AI Agent — abort',
    'quest:run': 'Quest Mode — run message',
    'quest:abort': 'Quest Mode — abort execution',
    'fs:read-dir': 'File System — read directory',
    'fs:read-file': 'File System — read file',
    'fs:write-file': 'File System — write file',
    'terminal:create': 'Terminal — create',
    'terminal:input': 'Terminal — write input',
    'network:diagnose': 'Network — diagnose',
  };

  const descriptions = missing.map((ch) => {
    const feature = featureMap[ch] || ch;
    return `  - "${ch}" → ${feature}`;
  });

  descriptions.push('');
  descriptions.push(`  💡 Solution: Download the latest version from https://ide.zhejiangjinmo.com/`);

  return descriptions;
}
