import { app, BrowserWindow } from 'electron';
import { readdirSync, unlinkSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function cleanupStaleProcesses(): void {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const win = windows[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  cleanupTempFiles();
  cleanupLockFiles();
}

function cleanupTempFiles(): void {
  const lingjingDir = join(homedir(), '.lingjing');
  if (!existsSync(lingjingDir)) return;

  const now = Date.now();
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const tmpExtensions = ['.tmp', '.lock', '.lck', '.pid'];

  try {
    const files = readdirSync(lingjingDir);
    for (const file of files) {
      const filePath = join(lingjingDir, file);
      try {
        const ext = file.substring(file.lastIndexOf('.'));
        if (!tmpExtensions.includes(ext)) continue;
        const stat = statSync(filePath);
        if (now - stat.mtimeMs > MAX_AGE_MS) {
          unlinkSync(filePath);
          console.log(`[StaleCleaner] Deleted expired temp file: ${file}`);
        }
      } catch { /* ignore individual file errors */ }
    }
  } catch (err) {
    console.warn('[StaleCleaner] Temp file cleanup failed:', err);
  }
}

function cleanupLockFiles(): void {
  const lingjingDir = join(homedir(), '.lingjing');
  if (!existsSync(lingjingDir)) return;

  const lockFiles = [
    'lingjing.db.tmp',
    'lingjing.db-journal',
    'lingjing.db-wal',
    'lingjing.db-shm',
  ];

  for (const file of lockFiles) {
    const filePath = join(lingjingDir, file);
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`[StaleCleaner] Deleted lock file: ${file}`);
      }
    } catch { /* ignore */ }
  }
}