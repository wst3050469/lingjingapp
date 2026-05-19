// Indexing IPC handler - codebase indexing status and file scanning

import { ipcMain, BrowserWindow } from 'electron';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig } from '@codepilot/core';
import { runIndexingPipeline, type IndexingProgress } from '../services/indexing-pipeline.js';
import { getDatabase, saveDatabase } from '../db/database.js';

export interface IndexStatus {
  indexed: boolean;
  fileCount: number;
  indexedCount: number;
  lastUpdated: string | null;
  workspace: string;
}

/** Count files recursively, respecting gitignore + custom ignore patterns */
async function countFiles(dir: string, ignorePatterns: string[]): Promise<number> {
  let count = 0;
  const skipDirs = new Set(['.git', 'node_modules', '.next', '.nuxt', 'dist', 'build', '__pycache__', '.cache', '.lingjing']);

  async function walk(currentDir: string, depth: number): Promise<void> {
    if (depth > 15) return; // prevent infinite recursion
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (skipDirs.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.isDirectory()) continue;

        const fullPath = join(currentDir, entry.name);
        const relativePath = fullPath.slice(dir.length + 1).replace(/\\/g, '/');

        // Check custom ignore patterns
        if (matchesAnyPattern(relativePath, entry.name, ignorePatterns)) continue;

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else {
          count++;
        }

        // Cap at 100001 for performance (we only need to know if > 100000)
        if (count > 100000) return;
      }
    } catch {
      // permission denied or similar
    }
  }

  await walk(dir, 0);
  return count;
}

function matchesAnyPattern(relativePath: string, name: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;

    // Directory pattern (ends with /)
    if (trimmed.endsWith('/')) {
      const dirName = trimmed.slice(0, -1);
      if (relativePath.includes(dirName + '/') || relativePath === dirName) return true;
      continue;
    }

    // Extension glob (*.ext)
    if (trimmed.startsWith('*.')) {
      const ext = trimmed.slice(1);
      if (name.endsWith(ext)) return true;
      continue;
    }

    // Double star glob (**/name)
    if (trimmed.startsWith('**/')) {
      const target = trimmed.slice(3);
      if (name === target || relativePath.includes('/' + target) || relativePath === target) return true;
      continue;
    }

    // Exact match
    if (relativePath === trimmed || name === trimmed) return true;
  }
  return false;
}

/** Read .gitignore patterns */
async function readGitignore(workspace: string): Promise<string[]> {
  const gitignorePath = join(workspace, '.gitignore');
  if (!existsSync(gitignorePath)) return [];
  try {
    const content = await readFile(gitignorePath, 'utf8');
    return content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  } catch {
    return [];
  }
}

/** Read .lingjingignore patterns */
async function readLingjingIgnore(workspace: string): Promise<string[]> {
  const ignorePath = join(workspace, '.lingjingignore');
  if (!existsSync(ignorePath)) return [];
  try {
    const content = await readFile(ignorePath, 'utf8');
    return content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  } catch {
    return [];
  }
}

// In-memory index state per workspace
const indexStates = new Map<string, { indexed: boolean; indexedCount: number; lastUpdated: string }>();

/** Latest indexing progress for real-time query (persists across page navigations) */
let latestProgress: IndexingProgress | null = null;

export function registerIndexingIpc(getWorkspace: () => string, mainWindow: BrowserWindow): void {
  // Return current progress in real-time (for StatusBar and any other component)
  ipcMain.handle('indexing:live-progress', () => {
    return latestProgress;
  });

  // Get indexing status for current workspace
  ipcMain.handle('indexing:status', async () => {
    try {
      const workspace = getWorkspace();
      if (!workspace || !existsSync(workspace)) {
        return { indexed: false, fileCount: 0, indexedCount: 0, lastUpdated: null, workspace: '' };
      }

      const state = indexStates.get(workspace);

      // If no in-memory state, try to read from database
      let indexedCount = state?.indexedCount ?? 0;
      let lastUpdated = state?.lastUpdated ?? null;
      if (!state) {
        try {
          const db = getDatabase();
          if (db) {
            const row = db.prepare('SELECT COUNT(*) as count FROM embeddings WHERE workspace = ?').getAsObject([workspace]) as { count: number } | undefined;
            if (row && row.count > 0) {
              indexedCount = row.count;
              lastUpdated = new Date().toISOString();
            }
          }
        } catch (dbErr) {
          console.error('indexing:status db fallback error:', dbErr);
        }
      }

      const gitignore = await readGitignore(workspace);
      const lingjingIgnore = await readLingjingIgnore(workspace);
      const allIgnore = [...gitignore, ...lingjingIgnore];
      const fileCount = await countFiles(workspace, allIgnore);

      return {
        indexed: state?.indexed ?? (indexedCount > 0),
        fileCount: Math.min(fileCount, 100001),
        indexedCount,
        lastUpdated,
        workspace,
      } satisfies IndexStatus;
    } catch (err) {
      console.error('indexing:status error:', err);
      return { indexed: false, fileCount: 0, indexedCount: 0, lastUpdated: null, workspace: '' };
    }
  });

  // Build/rebuild index for current workspace (with embedding pipeline)
  ipcMain.handle('indexing:build', async () => {
    try {
      const workspace = getWorkspace();
      if (!workspace || !existsSync(workspace)) {
        return { success: false, error: 'No workspace set' };
      }

      const gitignore = await readGitignore(workspace);
      const lingjingIgnore = await readLingjingIgnore(workspace);
      const allIgnore = [...gitignore, ...lingjingIgnore];
      const fileCount = await countFiles(workspace, allIgnore);

      if (fileCount > 100000) {
        return { success: false, error: 'Codebase exceeds 100,000 files limit' };
      }

      // Run embedding pipeline
      const loaded = await loadConfig();
      const result = await runIndexingPipeline(
        workspace,
        loaded.config,
        getDatabase(),
        saveDatabase,
        (progress: IndexingProgress) => {
          // Track latest progress for real-time queries
          latestProgress = progress;

          // Update state for status queries
          if (progress.phase === 'done') {
            indexStates.set(workspace, {
              indexed: true,
              indexedCount: progress.totalChunks,
              lastUpdated: new Date().toISOString(),
            });
          }

          // Send progress event to renderer for real-time UI updates
          try {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('indexing:progress', progress);
            }
          } catch { /* window destroyed during indexing */ }
        },
      );

      // Clear live progress when done
      if (result.success) {
        latestProgress = null;
      }

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Store index state
      indexStates.set(workspace, {
        indexed: true,
        indexedCount: result.chunksIndexed,
        lastUpdated: new Date().toISOString(),
      });

      return { success: true, fileCount: result.chunksIndexed };
    } catch (err) {
      console.error('indexing:build error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });

  // Read .lingjingignore file
  ipcMain.handle('indexing:get-ignore', async () => {
    try {
      const workspace = getWorkspace();
      const ignorePath = join(workspace, '.lingjingignore');
      if (!existsSync(ignorePath)) return { content: '', exists: false };
      const content = await readFile(ignorePath, 'utf8');
      return { content, exists: true };
    } catch (err) {
      console.error('indexing:get-ignore error:', err);
      return { content: '', exists: false };
    }
  });

  // Write .lingjingignore file
  ipcMain.handle('indexing:set-ignore', async (_event, { content }: { content: string }) => {
    try {
      const workspace = getWorkspace();
      if (!workspace) return { success: false, error: 'No workspace set' };
      const { writeFile: write } = await import('node:fs/promises');
      await write(join(workspace, '.lingjingignore'), content, 'utf8');
      return { success: true };
    } catch (err) {
      console.error('indexing:set-ignore error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });
}
