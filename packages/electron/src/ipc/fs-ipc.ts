// Filesystem IPC handler

import { ipcMain, dialog, type BrowserWindow } from 'electron';
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

// Language detection from file extension
const LANG_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescriptreact',
  '.js': 'javascript', '.jsx': 'javascriptreact',
  '.json': 'json', '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.md': 'markdown', '.yaml': 'yaml', '.yml': 'yaml',
  '.xml': 'xml', '.svg': 'xml',
  '.py': 'python', '.rb': 'ruby', '.go': 'go',
  '.rs': 'rust', '.java': 'java', '.c': 'c', '.cpp': 'cpp',
  '.h': 'c', '.hpp': 'cpp', '.cs': 'csharp',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.sql': 'sql', '.graphql': 'graphql',
  '.toml': 'toml', '.ini': 'ini',
  '.dockerfile': 'dockerfile',
  '.gitignore': 'plaintext', '.env': 'plaintext',
};

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath).toLowerCase();
  if (name === 'dockerfile') return 'dockerfile';
  if (name === 'makefile') return 'makefile';
  return LANG_MAP[ext] || 'plaintext';
}

// Hidden/ignored directories
const IGNORED = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build',
  '__pycache__', '.cache', '.vscode', '.idea', 'coverage',
]);

export function registerFsIpc(mainWindow: BrowserWindow, getWorkspace?: () => string): void {
  ipcMain.handle('fs:read-dir', async (_event, { path: dirPath }: { path: string }) => {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue;
        if (IGNORED.has(entry.name)) continue;

        result.push({
          name: entry.name,
          path: join(dirPath, entry.name),
          isDirectory: entry.isDirectory(),
        });
      }

      // Sort: directories first, then files, alphabetical
      result.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return result;
    } catch {
      return [];
    }
  });

  ipcMain.handle('fs:read-file', async (_event, { path: filePath }: { path: string }) => {
    const content = await readFile(filePath, 'utf-8');
    const language = detectLanguage(filePath);
    return { content, language };
  });

  ipcMain.handle('fs:write-file', async (_event, { path: filePath, content }: { path: string; content: string }) => {
    await writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('fs:select-folder', async () => {
    const defaultPath = getWorkspace?.();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      defaultPath: defaultPath || undefined,
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Open file dialog - returns selected file path(s)
  ipcMain.handle('fs:select-file', async (_event, options?: { filters?: Electron.FileFilter[] }) => {
    const { filters } = options || {};
    const defaultPath = getWorkspace?.();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      defaultPath: defaultPath || undefined,
      filters: filters || [
        { name: '所有支持的文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx'] },
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
        { name: '文档', extensions: ['pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePaths;
  });

  // Save-as dialog - returns selected save path
  ipcMain.handle('fs:save-as', async (_event, { defaultName }: { defaultName?: string }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
    });
    return result.canceled ? null : result.filePath;
  });
}
