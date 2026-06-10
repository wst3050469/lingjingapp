import { app, dialog, BrowserWindow } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getConsecutiveFailures, getTotalConsecutiveFailures } from './startup-stats.js';

const ROLLBACK_MARKER = join(homedir(), '.lingjing', '.rollback-pending');
const ROLLBACK_THRESHOLD = 3;

/**
 * v1.72.11: Only trigger rollback if failures are from the CURRENT version.
 * Cross-version failures (e.g., from a previously buggy version) should not
 * trigger a rollback on a fresh install/upgrade.
 */
export function checkRollbackNeeded(): boolean {
  const currentVersion = app.getVersion();
  const consecutiveSameVersion = getConsecutiveFailures();
  const totalConsecutive = getTotalConsecutiveFailures();

  console.log(`[SafeRollback] Consecutive failures: ${consecutiveSameVersion} (same version), ${totalConsecutive} (total)`);
  console.log(`[SafeRollback] Current version: ${currentVersion}, threshold: ${ROLLBACK_THRESHOLD}`);

  // Only rollback if SAME version has 3+ consecutive failures
  // Cross-version failures are logged but don't trigger rollback
  return consecutiveSameVersion >= ROLLBACK_THRESHOLD;
}

export async function executeRollback(mainWindow: BrowserWindow | null): Promise<void> {
  try {
    writeFileSync(ROLLBACK_MARKER, JSON.stringify({
      timestamp: new Date().toISOString(),
      version: app.getVersion(),
      platform: process.platform,
    }));
  } catch { /* ignore */ }

  const lingjingDir = join(homedir(), '.lingjing');
  const timestamp = Date.now();
  const backupDir = join(homedir(), `.lingjing.backup.${timestamp}`);

  try {
    mkdirSync(backupDir, { recursive: true });

    const dbPath = join(lingjingDir, 'lingjing.db');
    if (existsSync(dbPath)) {
      copyFileSync(dbPath, join(backupDir, 'lingjing.db'));
    }

    const configPath = join(lingjingDir, 'config.json');
    if (existsSync(configPath)) {
      copyFileSync(configPath, join(backupDir, 'config.json'));
    }

    // Only reset workspace — keep API keys and other settings intact
    let cfg: any = {};
    try {
      cfg = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch { /* ignore */ }
    cfg.lastWorkspace = homedir();
    writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    console.log('[SafeRollback] Config workspace reset to defaults, backup at:', backupDir);
  } catch (err) {
    console.error('[SafeRollback] Rollback backup/reset failed:', err);
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '灵境 - 启动回滚',
      message: '检测到当前版本连续启动失败，已自动回滚工作区配置',
      detail: `备份位置: ${backupDir}\n\n建议：\n1. 点击"重试"重新启动\n2. 如问题持续，请删除 ~/.lingjing/lingjing.db 后重试\n3. 或联系技术支持`,
      buttons: ['重试', '退出'],
      defaultId: 0,
    });

    try { unlinkSync(ROLLBACK_MARKER); } catch { /* ignore */ }

    if (result.response === 0) {
      mainWindow.webContents.reload();
    } else {
      app.quit();
    }
  } else {
    try {
      await app.whenReady();
      dialog.showErrorBox(
        '灵境 - 启动回滚',
        `检测到当前版本连续启动失败，已自动回滚配置。\n备份位置: ${backupDir}\n请重新启动应用。`
      );
    } catch { /* ignore */ }
    try { unlinkSync(ROLLBACK_MARKER); } catch { /* ignore */ }
    app.quit();
  }
}

export function hasPendingRollback(): boolean {
  return existsSync(ROLLBACK_MARKER);
}
