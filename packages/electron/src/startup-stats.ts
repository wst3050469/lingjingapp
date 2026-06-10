import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { app } from 'electron';

interface StartupRecord {
  version: string;
  timestamp: string;
  success: boolean;
  totalTimeMs: number;
  failures: string[];
  platform: string;
}

interface StartupStats {
  records: StartupRecord[];
}

const STATS_PATH = join(homedir(), '.lingjing', 'startup-stats.json');
const MAX_RECORDS = 100;

function readStats(): StartupStats {
  try {
    if (existsSync(STATS_PATH)) {
      return JSON.parse(readFileSync(STATS_PATH, 'utf8'));
    }
  } catch { /* ignore */ }
  return { records: [] };
}

function writeStats(stats: StartupStats): void {
  try {
    const dir = join(homedir(), '.lingjing');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
  } catch (err) {
    console.warn('[StartupStats] Failed to write stats:', err);
  }
}

export function recordStartup(success: boolean, totalTimeMs: number, failures: string[]): void {
  const stats = readStats();
  const record: StartupRecord = {
    version: app.getVersion(),
    timestamp: new Date().toISOString(),
    success,
    totalTimeMs,
    failures,
    platform: process.platform,
  };
  stats.records.push(record);
  if (stats.records.length > MAX_RECORDS) {
    stats.records = stats.records.slice(-MAX_RECORDS);
  }
  writeStats(stats);
}

/**
 * Count consecutive failures for the CURRENT version only.
 * v1.72.11: Previous versions counted ALL versions' failures together,
 * causing false rollbacks when upgrading from a buggy version.
 * Now we only count failures from the same version to avoid
 * cross-version contamination.
 */
export function getConsecutiveFailures(): number {
  const stats = readStats();
  const currentVersion = app.getVersion();
  let count = 0;
  for (let i = stats.records.length - 1; i >= 0; i--) {
    if (stats.records[i].version === currentVersion && !stats.records[i].success) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function getSuccessRate(): number {
  const stats = readStats();
  const recent = stats.records.slice(-10);
  if (recent.length === 0) return 1;
  const successes = recent.filter(r => r.success).length;
  return successes / recent.length;
}

/**
 * v1.72.11: Get total consecutive failures across ALL versions.
 * Used for diagnostics only, not for rollback decisions.
 */
export function getTotalConsecutiveFailures(): number {
  const stats = readStats();
  let count = 0;
  for (let i = stats.records.length - 1; i >= 0; i--) {
    if (!stats.records[i].success) {
      count++;
    } else {
      break;
    }
  }
  return count;
}
