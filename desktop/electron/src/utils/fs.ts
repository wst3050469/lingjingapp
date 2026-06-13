import { mkdirSync, existsSync } from 'node:fs';

/**
 * Ensure a directory exists, creating it recursively if needed.
 * Synchronous because called during initialization (pre-async context).
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}
