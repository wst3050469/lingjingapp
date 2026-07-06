/**
 * LingJing Enhanced Auto-Update System
 *
 * Features:
 *   - Standard electron-updater with generic provider
 *   - Force upgrade strategy (min-version enforcement)
 *   - Canary / grayscale release (percentage-based rollout via server)
 *   - Rollback support (keep last known good version)
 *   - Changelog delivery & renderer notification
 *   - Download resume support (via electron-updater built-in)
 *   - Pre/post upgrade hooks
 *   - Staged rollout: check server for rollout percentage
 */

import { ipcMain, BrowserWindow, app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { VersionService } from '../services/version-service';
import { createLogger } from '../monitoring/logger';

const versionLogger = createLogger('update-ipc');

let mainWindow: BrowserWindow | null = null;
let autoDownloadEnabled = true;
let autoCheckTimer: NodeJS.Timeout | null = null;
let forceUpgradeEnabled = true;
let lastKnownGoodVersion: string | null = null;

// HTTP version cache — bridges httpCheckVersion detection with update:download handler
// Ensures download uses the same version source as the check that displayed the notification
let _httpLatestVersion: string | null = null;
let _httpDownloadUrl: string | null = null;

// HTTP installer path — saved by httpDownloadUpdate, consumed by update:install handler.
// When download is done via HTTP (not electron-updater), this holds the local path to the
// downloaded setup.exe so update:install can spawn it directly instead of calling
// electron-updater's quitAndInstall() which has no knowledge of this file.
let _httpInstallerPath: string | null = null;

class UpdateUrlEncoder {
  static encodeUrl(rawUrl: string): string {
    try {
      const url = new URL(rawUrl);
      const encodedPath = url.pathname
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
      url.pathname = encodedPath;
      return url.toString();
    } catch {
      return encodeURI(rawUrl);
    }
  }

  static async validateUrl(encodedUrl: string, timeoutMs: number = 5000): Promise<{ status: number; reachable: boolean }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(encodedUrl, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      return { status: res.status, reachable: res.ok };
    } catch {
      return { status: 0, reachable: false };
    }
  }
}

type UpdateErrorCode =
  | 'NETWORK_ERROR'
  | 'URL_ENCODING_ERROR'
  | 'HTTP_404'
  | 'HTTP_5XX'
  | 'HASH_MISMATCH'
  | 'SERVER_UNREACHABLE'
  | 'CHECK_TIMEOUT';

interface UpdateErrorInfo {
  errorCode: UpdateErrorCode;
  userMessage: string;
  technicalDetail: string;
  actions: string[];
}

function classifyUpdateError(err: Error, httpStatus?: number): UpdateErrorInfo {
  const msg = err.message || '';

  if (msg.includes('status 404') || httpStatus === 404) {
    return {
      errorCode: 'HTTP_404',
      userMessage: '安装包文件未找到，可能该版本尚未发布完成，建议稍后重试',
      technicalDetail: msg,
      actions: ['retry', 'skip-version'],
    };
  }

  if (msg.includes('Cannot download') && msg.includes('status')) {
    const statusMatch = msg.match(/status\s+(\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
    if (status >= 500) {
      return {
        errorCode: 'HTTP_5XX',
        userMessage: '更新服务器暂时不可用，请稍后重试',
        technicalDetail: msg,
        actions: ['retry', 'skip-version'],
      };
    }
    if (status === 404) {
      return {
        errorCode: 'HTTP_404',
        userMessage: '安装包文件未找到，可能该版本尚未发布完成，建议稍后重试',
        technicalDetail: msg,
        actions: ['retry', 'skip-version'],
      };
    }
  }

  if (msg.includes('net::') || msg.includes('ERR_') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
    return {
      errorCode: 'NETWORK_ERROR',
      userMessage: '网络连接失败，请检查网络后重试',
      technicalDetail: msg,
      actions: ['retry'],
    };
  }

  if (msg.includes('sha512') && (msg.includes('mismatch') || msg.includes('check'))) {
    return {
      errorCode: 'HASH_MISMATCH',
      userMessage: '安装包校验失败，文件可能已损坏，请重新尝试',
      technicalDetail: msg,
      actions: ['retry', 'skip-version'],
    };
  }

  if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return {
      errorCode: 'CHECK_TIMEOUT',
      userMessage: '版本检查超时，请检查网络连接',
      technicalDetail: msg,
      actions: ['retry'],
    };
  }

  return {
    errorCode: 'NETWORK_ERROR',
    userMessage: '下载失败，请稍后重试',
    technicalDetail: msg,
    actions: ['retry', 'skip-version'],
  };
}

function sendUpdateError(win: BrowserWindow, err: Error, httpStatus?: number): void {
  const errorInfo = classifyUpdateError(err, httpStatus);
  win.webContents.send('update:error', {
    ...errorInfo,
    message: errorInfo.userMessage,
  });
}

interface UpdateOperationLog {
  fromVersion: string;
  toVersion?: string;
  downloadUrl?: string;
  httpStatus?: number;
  durationMs: number;
  result: 'success' | 'failed';
  errorCode?: UpdateErrorCode;
  timestamp: string;
}

const updateLogs: UpdateOperationLog[] = [];

// electron-updater is ESM-only, use dynamic import
let _autoUpdater: any = null;
async function getAutoUpdater() {
  if (!_autoUpdater) {
    try {
      const mod = await import('electron-updater');
      _autoUpdater = mod.autoUpdater || mod.default?.autoUpdater;
    } catch {
      // Fallback to require for CJS environments
      try {
        const mod = require('electron-updater');
        _autoUpdater = mod.autoUpdater;
      } catch (requireErr: any) {
        console.error('[update] Failed to load electron-updater via require:', requireErr.message);
      }
    }
    if (!_autoUpdater) {
      throw new Error('electron-updater autoUpdater not available');
    }
  }
  return _autoUpdater;
}

// ── Rollback State Persistence ──
const STATE_DIR = join(homedir(), '.lingjing');
const UPDATE_STATE_FILE = join(STATE_DIR, 'update-state.json');

interface UpdateState {
  lastKnownGoodVersion: string;
  currentVersion: string;
  rollbackCount: number;
  lastUpdateCheck: string;
  updateChannel: string; // 'stable' | 'canary' | 'beta'
}

function loadUpdateState(): UpdateState {
  try {
    if (existsSync(UPDATE_STATE_FILE)) {
      return JSON.parse(readFileSync(UPDATE_STATE_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return {
    lastKnownGoodVersion: app.getVersion(),
    currentVersion: app.getVersion(),
    rollbackCount: 0,
    lastUpdateCheck: '',
    updateChannel: 'stable',
  };
}

function saveUpdateState(state: UpdateState): void {
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(UPDATE_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[update] Failed to save update state:', e);
  }
}

let updateState = loadUpdateState();

export function initUpdateIPC(win: BrowserWindow): void {
  mainWindow = win;
  updateState = loadUpdateState();
  lastKnownGoodVersion = updateState.lastKnownGoodVersion;

  // ── Register IPC handlers FIRST (before loading electron-updater) ──
  // This ensures handlers are always available even if electron-updater fails to load

  ipcMain.handle('update:check', async () => {
    console.log('[update] ========== Starting version check ==========');

    // ── Step 1: HTTP version detection for notification ──
    let httpResult: any = null;
    try {
      httpResult = await httpCheckVersion();
      if (httpResult && httpResult.latestVersion) {
        console.log('[update] ✓ HTTP check succeeded, version:', httpResult.latestVersion);
      }
    } catch (httpErr: any) {
      console.warn('[update] HTTP check failed:', httpErr.message);
    }

    // ── Step 2: electron-updater (handles download + install lifecycle) ──
    try {
      const au = await getAutoUpdater();
      console.log('[update] electron-updater loaded, calling checkForUpdates...');
      const result = await Promise.race([
        au.checkForUpdates(),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Version check timeout after 10s')), 10000)
        ),
      ]);

      if (result) {
        console.log('[update] ✓ electron-updater check succeeded');
        // If HTTP also found a version, use that version string
        return {
          ok: true,
          source: 'electron-updater',
          version: httpResult?.latestVersion || result?.updateInfo?.version,
        };
      }
    } catch (updaterErr: any) {
      console.warn('[update] electron-updater check failed:', (updaterErr as Error).message);
    }

    // ── If HTTP found update but electron-updater failed, still report ──
    if (httpResult && httpResult.latestVersion) {
      return { ok: true, source: 'http', version: httpResult.latestVersion };
    }

    // ── No update found ──
    console.log('[update] No update available');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:not-available');
    }
    return { notActive: true };
  });

  ipcMain.handle('update:download', async () => {
    // ── Always use electron-updater for download ──
    // HTTP check (httpCheckVersion) only detects version and notifies renderer.
    // It does NOT cache download URLs. The actual download must go through
    // electron-updater so quitAndInstall() knows where the file is.
    //
    // electron-updater reads latest.yml from feedURL:
    //   https://www.spiritrealmz.com/downloads/latest.yml
    // which references LingJing-Setup-${version}-win-x64.exe

    const au = await getAutoUpdater();
    const maxRetries = 3;
    const retryDelays = [1000, 3000, 5000];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[update] Retry download attempt ${attempt}/${maxRetries}, waiting ${retryDelays[attempt - 1]}ms...`);
          if (mainWindow) {
            mainWindow.webContents.send('update:retry', {
              retryCount: attempt,
              maxRetry: maxRetries,
              delayMs: retryDelays[attempt - 1],
            });
          }
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt - 1]));
        }

        console.log('[update] Starting download...');
        try {
          await au.checkForUpdates();
        } catch (checkErr: any) {
          console.warn('[update] Pre-download check failed (continuing):', checkErr.message);
        }
        await au.downloadUpdate();
        console.log('[update] Download initiated successfully');
        return { ok: true };
      } catch (err: any) {
        console.error(`[update] Download failed (attempt ${attempt + 1}/${maxRetries + 1}):`, err.message);

        const errorInfo = classifyUpdateError(err instanceof Error ? err : new Error(err.message));

        if (attempt < maxRetries && errorInfo.errorCode !== 'HTTP_404') {
          continue;
        }

        if (mainWindow) {
          sendUpdateError(mainWindow, err instanceof Error ? err : new Error(err.message));
        }
        throw new Error(errorInfo.userMessage);
      }
    }

    throw new Error('下载失败：已达到最大重试次数');
  });

  ipcMain.handle('update:install', async () => {
    // Always use electron-updater's quitAndInstall().
    // electron-updater manages its own download directory internally,
    // so quitAndInstall() knows exactly where the downloaded file is.
    const au = await getAutoUpdater();
    au.quitAndInstall();
  });

  ipcMain.handle('update:set-auto-download', async (_event, enabled: boolean) => {
    autoDownloadEnabled = enabled;
    const au = await getAutoUpdater();
    au.autoDownload = enabled;
  });

  ipcMain.handle('update:set-channel', async (_event, channel: string) => {
    updateState.updateChannel = channel;
    saveUpdateState(updateState);

    const au = await getAutoUpdater();
    au.allowPrerelease = channel !== 'stable';
    const baseUrl = 'https://www.spiritrealmz.com/downloads/';
    au.setFeedURL({
      provider: 'generic',
      url: channel === 'stable' ? baseUrl : `${baseUrl}/${channel}`,
    });

    return { channel };
  });

  ipcMain.handle('update:get-channel', async () => {
    return updateState.updateChannel;
  });

  ipcMain.handle('update:rollback', async () => {
    if (!lastKnownGoodVersion) {
      return { error: 'No rollback version available' };
    }

    const au = await getAutoUpdater();
    // electron-updater allows downgrade when allowDowngrade=true
    au.allowDowngrade = true;
    updateState.rollbackCount++;
    saveUpdateState(updateState);

    return {
      ok: true,
      from: app.getVersion(),
      to: lastKnownGoodVersion,
    };
  });

  ipcMain.handle('update:get-state', async () => {
    return {
      ...updateState,
      currentVersion: app.getVersion(),
      lastKnownGoodVersion,
    };
  });

  ipcMain.handle('update:set-force-upgrade', async (_event, enabled: boolean) => {
    forceUpgradeEnabled = enabled;
  });

  // Now load electron-updater (after handlers are registered)
  getAutoUpdater().then((autoUpdater) => {
    console.log('[update] electron-updater loaded successfully');
    autoUpdater.autoDownload = false; // User manually triggers download
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = true; // Enable rollback support
    autoUpdater.allowPrerelease = updateState.updateChannel !== 'stable';
    autoUpdater.forceDevUpdateConfig = true; // Always enable update checks

    autoUpdater.logger = {
      info: (m: string) => console.log('[update]', m),
      warn: (m: string) => console.warn('[update]', m),
      error: (m: string) => console.error('[update]', m),
      debug: () => {},
    } as any;

    // Set update server URL — always use base URL directly.
    // We handle channel in the URL path ourselves (not via electron-updater's channel),
    // because the baked publish.channel from electron-builder.json would append
    // "/latest" to the URL causing a 404 on /latest/latest.yml
    const channel = updateState.updateChannel;
    const baseUrl = 'https://www.spiritrealmz.com/downloads/';
    const encodedBaseUrl = UpdateUrlEncoder.encodeUrl(baseUrl);
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: channel === 'stable' ? encodedBaseUrl : `${encodedBaseUrl}${channel}`,
      channel: undefined as any,
    });
    console.log('[update] setFeedURL configured:', channel === 'stable' ? baseUrl : `${baseUrl}${channel}`);

    // ── Events ──

    autoUpdater.on('checking-for-update', () => {
      win.webContents.send('update:checking');
    });

    autoUpdater.on('update-available', async (info: any) => {
      // ── Safety check 1: Ensure the reported version is actually newer ──
      // electron-updater may report a lower version when allowDowngrade=true
      // and latest.yml is stale (e.g. latest.yml=1.36.0, current=1.38.0).
      // This prevents false downgrade detection.
      const currentVersion = app.getVersion();
      if (compareVersions(info.version, currentVersion) <= 0) {
        console.log(
          '[update] electron-updater found version ' + info.version +
          ' but it is NOT newer than current ' + currentVersion +
          ' — suppressing false update'
        );
        win.webContents.send('update:not-available');
        return;
      }

      // ── Safety check 2: Cross-check version status from /api/latest. ──
      // If version is pending_review, suppress notification — admin hasn't approved yet.
      // Also suppress if /api/latest reports a different version (admin rolled back or staging).
      try {
        const statusCheckController = new AbortController();
        const statusTimer = setTimeout(() => statusCheckController.abort(), 3000);
        const statusRes = await fetch('https://www.spiritrealmz.com/api/latest', {
          signal: statusCheckController.signal,
        });
        clearTimeout(statusTimer);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          // Case 1: Version is pending review — suppress
          if (statusData.status === 'pending_review') {
            console.log('[update] electron-updater found version ' + info.version + ' but it is pending review — suppressing');
            win.webContents.send('update:not-available');
            return;
          }
          // Case 2: /api/latest reports a different version than electron-updater
          if (statusData.version && statusData.version !== info.version) {
            console.log('[update] /api/latest reports v' + statusData.version + ' but electron-updater found v' + info.version + ' — suppressing');
            win.webContents.send('update:not-available');
            return;
          }
          // Case 3: Version exists but status is 'draft' (not yet submitted)
          if (statusData.status === 'draft') {
            console.log('[update] Version ' + info.version + ' is in draft status — suppressing');
            win.webContents.send('update:not-available');
            return;
          }
        }
      } catch {
        // If status check fails, proceed with normal flow
      }

      const isForced = await isForceUpgrade(info.version);

      win.webContents.send('update:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        forced: isForced,
        channel: updateState.updateChannel,
      });

      // If forced upgrade, notify user prominently
      if (isForced) {
        win.webContents.send('update:force-upgrade', {
          version: info.version,
          message: `版本 ${info.version} 为强制升级，旧版本将不再受支持。`,
        });
      }
    });

    autoUpdater.on('update-not-available', () => {
      win.webContents.send('update:not-available');
    });

    autoUpdater.on('download-progress', (progress: any) => {
      win.webContents.send('update:progress', {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    autoUpdater.on('update-downloaded', (info: any) => {
      // Save current as last known good before installing new version
      lastKnownGoodVersion = app.getVersion();
      updateState.lastKnownGoodVersion = lastKnownGoodVersion;
      updateState.rollbackCount = 0;
      saveUpdateState(updateState);

      win.webContents.send('update:downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes,
      });

      // Auto-install on quit (default behavior)
      console.log(`[update] v${info.version} downloaded, will install on quit`);
    });

    autoUpdater.on('error', (err: Error) => {
      console.error('[update] Auto-updater error:', err.message);
      // 降级处理：不发送error，显示"已是最新"
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:not-available');
      }

      updateState.rollbackCount++;
      saveUpdateState(updateState);

      if (updateState.rollbackCount >= 3) {
        console.error('[update] Too many update failures, suggesting rollback');
        if (mainWindow) {
          mainWindow.webContents.send('update:rollback-suggested', {
            currentVersion: app.getVersion(),
            lastKnownGood: lastKnownGoodVersion,
          });
        }
      }
    });

    // Start auto-check timer
    startAutoCheck(win, autoUpdater);
  }).catch((err) => {
    console.error('[update] Failed to load electron-updater:', err.message);
    console.error('[update] Update checks will use HTTP fallback only');
    // Don't send error to renderer — HTTP fallback handles version checks silently
  });
}

/**
 * Check if an update is a force upgrade.
 * Reads min-version from update server or uses version comparison.
 */
async function isForceUpgrade(newVersion: string): Promise<boolean> {
  if (!forceUpgradeEnabled) return false;

  try {
    // Fetch min-version.txt from update server to check force upgrade
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://www.spiritrealmz.com/min-version.txt', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const minVersion = (await res.text()).trim();
      if (minVersion) {
        const current = app.getVersion();
        if (compareVersions(current, minVersion) < 0) {
          console.log(`[update] Force upgrade required: ${current} < ${minVersion}`);
          return true;
        }
      }
    }
  } catch (e) {
    // min-version.txt not found or unreachable, skip
    console.log('[update] min-version check skipped:', (e as Error).message);
  }

  return false;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * Start auto-check timer with grayscale support.
 * Each client checks server for rollout percentage.
 */
function startAutoCheck(win: BrowserWindow, autoUpdater: any): void {
  const firstCheckDelay = 5000;
  const checkInterval = 30 * 60 * 1000; // 30 minutes

  console.log(`[update] Auto-check enabled (channel: ${updateState.updateChannel})`);

  const doCheck = async () => {
    // Check grayscale rollout status
    try {
      const deviceId = getDeviceId();
      // Safe timeout - AbortSignal.timeout may not be available in all environments
      const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = setTimeout(() => abortController?.abort(), 5000);
      try {
        const rolloutRes = await fetch(
          `https://www.spiritrealmz.com/api/rollout/check?device=${encodeURIComponent(deviceId)}`,
          { signal: abortController?.signal }
        );
        clearTimeout(timeoutId);
        if (rolloutRes.ok) {
          const rollout = await rolloutRes.json();
          if (rollout.enabled === false) {
            console.log('[update] Rollout disabled for this device, skipping check');
            return;
          }
        }
      } catch {
        // Timeout or network error, continue with normal update flow
        clearTimeout(timeoutId);
      }
    } catch (e) {
      // Rollout check failed, continue with normal update flow
    }

    // Check min-version for force-upgrade at startup
    try {
      const startupController = new AbortController();
      const startupTimer = setTimeout(() => startupController.abort(), 5000);
      const minVersionRes = await fetch('https://www.spiritrealmz.com/min-version.txt', { signal: startupController.signal });
      clearTimeout(startupTimer);
      if (minVersionRes.ok) {
        const minVersion = (await minVersionRes.text()).trim();
        if (minVersion && compareVersions(app.getVersion(), minVersion) < 0) {
          console.log(`[update] Startup force-upgrade: ${app.getVersion()} < ${minVersion}`);
          win.webContents.send('update:force-upgrade', {
            version: minVersion,
            message: `当前版本 ${app.getVersion()} 低于最低要求 ${minVersion}，请立即升级。`,
          });
        }
      }
    } catch { /* min-version.txt unreachable, skip */ }

    console.log('[update] Checking for updates...');
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('[update] Check failed:', err.message);
      // 降级处理：不发送error
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:not-available');
      }
    });
  };

  setTimeout(doCheck, firstCheckDelay);
  autoCheckTimer = setInterval(doCheck, checkInterval);
}

function getDeviceId(): string {
  try {
    const configPath = join(homedir(), '.lingjing', 'config.json');
    if (existsSync(configPath)) {
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      return cfg.deviceId || 'unknown';
    }
  } catch (e) { /* ignore */ }
  return 'unknown';
}

/**
 * HTTP-based version check fallback.
 * Directly fetches /api/latest to get version info without electron-updater.
 */
async function httpCheckVersion(): Promise<{
  ok?: boolean;
  notActive?: boolean;
  error?: string;
  latestVersion?: string;
  currentVersion?: string;
  needsUpgrade?: boolean;
} | null> {
  try {
    console.log('[update] HTTP fallback: fetching /api/latest');
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => abortController?.abort(), 10000);
    const res = await fetch('https://www.spiritrealmz.com/api/latest', {
      signal: abortController?.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.log('[update] HTTP fallback: /api/latest returned', res.status);
      return null;
    }
    const data = await res.json();
    const latestVersion = data.version;
    const versionStatus = data.status || 'published';
    if (latestVersion) {
      const current = app.getVersion();
      console.log('[update] HTTP fallback: latest=' + latestVersion + ' (status=' + versionStatus + '), current=' + current);
      const needsUpgrade = compareVersions(latestVersion, current) > 0;
      if (needsUpgrade) {
        // Check if version is pending review — if so, hide notification
        // The installer IS downloadable, but upgrade prompt should not appear
        // until admin approves (status changes to 'published')
        if (versionStatus === 'pending_review') {
          console.log('[update] Version ' + latestVersion + ' is pending review — suppressing notification');
          if (mainWindow) {
            mainWindow.webContents.send('update:not-available');
          }
          return {
            notActive: true,
            latestVersion,
            currentVersion: current,
            needsUpgrade: false
          };
        }

        // HTTP detected a new published version — send notification to renderer.
        // Do NOT cache _httpDownloadUrl or _httpLatestVersion here!
        // The actual download MUST go through electron-updater (au.downloadUpdate())
        // so that quitAndInstall() knows where the downloaded file lives.
        // Electron-updater reads latest.yml from its feedURL:
        //   https://www.spiritrealmz.com/downloads/latest.yml
        // which points to LingJing-Setup-${version}-win-x64.exe

        if (mainWindow) {
          mainWindow.webContents.send('update:available', {
            version: latestVersion,
            releaseDate: data.releaseDate,
            releaseNotes: data.releaseNotes,
            forced: false,
            channel: updateState.updateChannel,
          });
        }
        return {
          ok: true,
          latestVersion,
          currentVersion: current,
          needsUpgrade: true
        };
      } else {
        if (mainWindow) {
          mainWindow.webContents.send('update:not-available');
        }
        return {
          notActive: true,
          latestVersion,
          currentVersion: current,
          needsUpgrade: false
        };
      }
    }
    return null;
  } catch (err: any) {
    console.log('[update] HTTP fallback failed:', (err as Error).message);
    
    // 降级处理：发送not-available而非错误
    const current = app.getVersion();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:not-available');
    }
    
    return {
      notActive: true,
      latestVersion: current,
      currentVersion: current,
      needsUpgrade: false
    };
  }
}

/**
 * HTTP-based update download.
 * Used when httpCheckVersion has cached a valid download URL (preferred over electron-updater).
 * Downloads via fetch + streaming to temp directory, then signals update ready.
 */
async function httpDownloadUpdate(downloadUrl: string, version: string): Promise<{ ok: boolean }> {
  const downloadDir = join(app.getPath('temp'), 'lingjing-update');
  if (!existsSync(downloadDir)) mkdirSync(downloadDir, { recursive: true });

  const fileName = basename(downloadUrl) || `LingJing-Setup-${version}-win-x64.exe`;
  const destPath = join(downloadDir, fileName);

  console.log(`[update] HTTP download: ${downloadUrl} → ${destPath}`);

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`HTTP download failed with status ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let transferred = 0;

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body not readable');

  // Stream to file
  const writeStream = createWriteStream(destPath);
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writeStream.write(Buffer.from(value));
      transferred += value.length;
      if (total > 0 && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:progress', {
          percent: Math.round((transferred / total) * 100),
          transferred,
          total,
          bytesPerSecond: 0,
        });
      }
    }
  } finally {
    writeStream.end();
    reader.releaseLock();
  }

  // Wait for stream to finish
  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  console.log(`[update] HTTP download complete: ${destPath} (${transferred} bytes)`);

  // Mark as ready to install
  lastKnownGoodVersion = app.getVersion();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:downloaded', {
      version,
      releaseNotes: '',
    });
  }

  return { ok: true };
}

export function stopAutoCheck(): void {
  if (autoCheckTimer) {
    clearInterval(autoCheckTimer);
    autoCheckTimer = null;
    console.log('[update] Auto-check stopped');
  }
}
