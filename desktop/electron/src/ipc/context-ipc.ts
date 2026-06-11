// Context IPC handler - provides context selector backend services
// Handles file search, rule listing, document parsing, git changes, and recent files

import { ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile as readFileFS, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, relative, basename, extname, normalize } from 'node:path';
import fg from 'fast-glob';
import { loadConfig } from '@codepilot/core';
import { loadAllRules } from '@codepilot/core/rules';

const execFileAsync = promisify(execFile);

const IGNORED_DIRS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/__pycache__/**',
  '**/.cache/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
  '**/.vscode/**',
  '**/.idea/**',
];

export function registerContextIpc(getWorkspace: () => string): void {

  // ── File search using fast-glob ──
  ipcMain.handle('context:search-files', async (_event, { query, type }: { query: string; type: 'file' | 'folder' }) => {
    const cwd = getWorkspace();
    if (!query || !cwd) return [];

    try {
      const sanitizedQuery = query.replace(/[\\*?{}[\]()!]/g, '');
      if (!sanitizedQuery) return [];

      const pattern = type === 'folder'
        ? `**/*${sanitizedQuery}*`
        : `**/*${sanitizedQuery}*`;

      const entries = await fg(pattern, {
        cwd,
        ignore: IGNORED_DIRS,
        onlyDirectories: type === 'folder',
        onlyFiles: type === 'file',
        caseSensitiveMatch: false,
        deep: 8,
        suppressErrors: true,
        stats: true,
      });

      return entries.slice(0, 50).map((entry) => {
        const entryPath = typeof entry === 'string' ? entry : entry.path;
        const fullPath = resolve(cwd, entryPath);
        const stats = typeof entry === 'string' ? undefined : entry.stats;
        return {
          name: basename(entryPath),
          path: fullPath,
          isDirectory: type === 'folder',
          size: stats?.size,
        };
      });
    } catch (error) {
      console.error('Context search-files failed:', error);
      return [];
    }
  });

	  // ── Create a new rule file ──
	  ipcMain.handle('context:create-rule', async (_event, { name, content }: { name: string; content: string }) => {
	    const cwd = getWorkspace();
	    if (!cwd || !name.trim()) return { error: 'Invalid workspace or name' };

	    try {
	      const { mkdir, writeFile } = await import('node:fs/promises');
	      const rulesDir = resolve(cwd, '.lingjing', 'rules');
	      await mkdir(rulesDir, { recursive: true });
	      const fileName = name.replace(/[^a-zA-Z0-9_-]/g, '-') + '.md';
	      const filePath = resolve(rulesDir, fileName);
	      await writeFile(filePath, content, 'utf-8');
	      return { success: true, filePath, fileName };
	    } catch (error) {
	      console.error('Failed to create rule:', error);
	      return { error: (error as Error).message };
	    }
	  });


  // ── List all rules ──
  ipcMain.handle('context:list-rules', async () => {
    const cwd = getWorkspace();
    try {
      const loaded = await loadConfig();
      const configRules = (loaded.config as any).rules || [];
      const loadedRules = await loadAllRules(cwd, configRules);

      const allRules = [
        ...loadedRules.configRules.map((r: any) => ({ ...r, source: 'config' as const })),
        ...loadedRules.fileRules.map((r: any) => ({ ...r, source: 'file' as const })),
        ...(loadedRules.agentsMdRule ? [{ ...loadedRules.agentsMdRule, source: 'agents-md' as const }] : []),
      ];

      return allRules.map((r: any) => ({
        id: r.id || r.name || Math.random().toString(36).slice(2),
        name: r.name,
        type: r.type || 'manual',
        description: r.description || '',
        filePath: r.filePath || '',
        enabled: r.enabled !== false,
        source: r.source,
      }));
    } catch (error) {
      console.error('Context list-rules failed:', error);
      return [];
    }
  });

  // ── Parse document (pdf/docx/xlsx/xmind/md) ──
  ipcMain.handle('context:parse-document', async (_event, { filePath }: { filePath: string }) => {
    const cwd = getWorkspace();
    // Security: validate path is within workspace
    const normalizedPath = normalize(filePath);
    const normalizedCwd = normalize(cwd);
    if (!normalizedPath.startsWith(normalizedCwd) && !normalizedPath.startsWith(normalize(resolve(cwd)))) {
      // Allow absolute paths outside workspace for user-selected files
    }

    const ext = extname(filePath).toLowerCase();

    try {
      switch (ext) {
        case '.md':
        case '.txt': {
          const content = await readFileFS(filePath, 'utf-8');
          return { content: content.slice(0, 10000), type: 'markdown' };
        }
        case '.pdf': {
          const { PDFParse } = await import('pdf-parse');
          const buffer = await readFileFS(filePath);
          const parser = new PDFParse({ data: new Uint8Array(buffer) });
          const textResult = await parser.getText();
          await parser.destroy();
          return { content: (textResult.text || '').slice(0, 10000), type: 'pdf' };
        }
        case '.docx': {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ path: filePath });
          return { content: (result.value || '').slice(0, 10000), type: 'docx' };
        }
        case '.xlsx':
        case '.xls': {
          const Excel = await import('exceljs');
          const workbook = new Excel.Workbook();
          await workbook.xlsx.readFile(filePath);
          let text = '';
          workbook.eachSheet((worksheet) => {
            text += `[Sheet: ${worksheet.name}]\n`;
            worksheet.eachRow((row) => {
              const values = row.values && typeof row.values !== 'function' ? (row.values as any).slice(1) : [];
              const rowValues = values.map((v) => {
                if (v === undefined || v === null) return '';
                const str = String(v);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                  return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
              });
              text += rowValues.join(',') + '\n';
            });
            text += '\n';
          });
          return { content: text.slice(0, 10000), type: 'xlsx' };
        }
        case '.xmind': {
          const AdmZip = (await import('adm-zip')).default;
          const zip = new AdmZip(filePath);
          const contentEntry = zip.getEntry('content.json');
          if (contentEntry) {
            const jsonStr = contentEntry.getData().toString('utf-8');
            const data = JSON.parse(jsonStr);
            const text = extractXmindText(data);
            return { content: text.slice(0, 10000), type: 'xmind' };
          }
          return { content: '[XMind file - unable to parse content]', type: 'xmind' };
        }
        default:
          return { content: `[Unsupported file type: ${ext}]`, type: 'unknown' };
      }
    } catch (error) {
      console.error('Context parse-document failed:', error);
      return { content: `[Failed to parse document: ${(error as Error).message}]`, type: 'error' };
    }
  });

  // ── Git changed files ──
  ipcMain.handle('context:git-changed', async () => {
    const cwd = getWorkspace();
    try {
      const { stdout } = await execFileAsync(
        'git', ['status', '--porcelain'],
        { cwd, timeout: 5000 }
      );

      const files = stdout.trim().split('\n').filter(Boolean).map((line) => {
        const statusCode = line.substring(0, 2).trim();
        const filePath = line.substring(3).trim();
        const fullPath = resolve(cwd, filePath);
        let status: 'modified' | 'added' | 'deleted' | 'renamed' = 'modified';
        if (statusCode === '??' || statusCode.includes('A')) status = 'added';
        else if (statusCode.includes('D')) status = 'deleted';
        else if (statusCode.includes('R')) status = 'renamed';

        return {
          name: basename(filePath),
          path: fullPath,
          status,
        };
      });

      return files;
    } catch {
      return [];
    }
  });

  // ── Recent files (from git log) ──
  ipcMain.handle('context:recent-files', async (_event, { limit }: { limit?: number }) => {
    const cwd = getWorkspace();
    const maxFiles = limit || 15;
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['log', '--diff-filter=M', '--name-only', '--pretty=format:', `-n`, `${maxFiles * 2}`],
        { cwd, timeout: 5000 }
      );

      const seen = new Set<string>();
      const files: Array<{ name: string; path: string }> = [];

      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        files.push({
          name: basename(trimmed),
          path: resolve(cwd, trimmed),
        });
        if (files.length >= maxFiles) break;
      }

      return files;
    } catch {
      return [];
    }
  });
}

// Helper: recursively extract text from XMind JSON structure
function extractXmindText(data: any, indent = 0): string {
  let text = '';
  if (Array.isArray(data)) {
    for (const item of data) {
      text += extractXmindText(item, indent);
    }
  } else if (data && typeof data === 'object') {
    if (data.title) {
      text += '  '.repeat(indent) + data.title + '\n';
    }
    if (data.rootTopic) {
      text += extractXmindText(data.rootTopic, indent);
    }
    if (data.children?.attached) {
      for (const child of data.children.attached) {
        text += extractXmindText(child, indent + 1);
      }
    }
  }
  return text;
}
