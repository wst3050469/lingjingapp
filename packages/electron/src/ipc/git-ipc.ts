import { ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function registerGitIpc(getWorkspace: () => string): void {
  ipcMain.handle('git:status', async () => {
    const cwd = getWorkspace();
    try {
      const [branchResult, statusResult] = await Promise.allSettled([
        execFileAsync('git', ['branch', '--show-current'], { cwd, timeout: 3000 }),
        execFileAsync('git', ['status', '--short', '--branch'], { cwd, timeout: 3000 }),
      ]);

      const branch = branchResult.status === 'fulfilled'
        ? branchResult.value.stdout.trim()
        : null;

      let ahead = 0;
      let behind = 0;
      const files: Array<{ path: string; status: string; staged: boolean }> = [];

      if (statusResult.status === 'fulfilled') {
        const lines = statusResult.value.stdout.trim().split('\n');
        const branchLine = lines[0] || '';
        const aheadMatch = branchLine.match(/ahead (\d+)/);
        const behindMatch = branchLine.match(/behind (\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1]);
        if (behindMatch) behind = parseInt(behindMatch[1]);

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          const x = line[0];
          const y = line[1];
          const filePath = line.substring(3);
          if (x === '?' && y === '?') {
            files.push({ path: filePath, status: 'untracked', staged: false });
          } else {
            if (x !== ' ' && x !== '?') {
              files.push({ path: filePath, status: 'staged', staged: true });
            }
            if (y !== ' ' && y !== '?') {
              files.push({ path: filePath, status: 'modified', staged: false });
            }
          }
        }
      }

      const staged = files.filter(f => f.staged).length;
      const modified = files.filter(f => f.status === 'modified' && !f.staged).length;
      const untracked = files.filter(f => f.status === 'untracked').length;

      return { isRepo: branch !== null, branch, ahead, behind, modified, untracked, staged, files };
    } catch {
      return { isRepo: false, branch: null, ahead: 0, behind: 0, modified: 0, untracked: 0, staged: 0, files: [] };
    }
  });

  ipcMain.handle('git:add', async (_event, { paths }: { paths: string[] }) => {
    const cwd = getWorkspace();
    try {
      await execFileAsync('git', ['add', ...paths], { cwd, timeout: 10000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git:addAll', async () => {
    const cwd = getWorkspace();
    try {
      await execFileAsync('git', ['add', '-A'], { cwd, timeout: 10000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git:commit', async (_event, { message }: { message: string }) => {
    const cwd = getWorkspace();
    try {
      await execFileAsync('git', ['commit', '-m', message], { cwd, timeout: 15000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git:log', async (_event, { count }: { count?: number }) => {
    const cwd = getWorkspace();
    try {
      const n = count || 10;
      const { stdout } = await execFileAsync('git', ['log', `--max-count=${n}`, '--format=%H|%h|%s|%an|%ar'], { cwd, timeout: 5000 });
      return stdout.trim().split('\n').filter(Boolean).map((line) => {
        const [hash, shortHash, message, author, date] = line.split('|');
        return { hash, shortHash, message, author, date };
      });
    } catch {
      return [];
    }
  });

  ipcMain.handle('git:init', async () => {
    const cwd = getWorkspace();
    try {
      await execFileAsync('git', ['init'], { cwd, timeout: 10000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git:checkout', async (_event, { paths }: { paths: string[] }) => {
    const cwd = getWorkspace();
    try {
      await execFileAsync('git', ['checkout', '--', ...paths], { cwd, timeout: 10000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git:restore', async (_event, { paths, staged }: { paths: string[]; staged?: boolean }) => {
    const cwd = getWorkspace();
    try {
      const args = staged ? ['restore', '--staged', '--', ...paths] : ['restore', '--', ...paths];
      await execFileAsync('git', args, { cwd, timeout: 10000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git:stash', async (_event, { message }: { message?: string }) => {
    const cwd = getWorkspace();
    try {
      const args = message ? ['stash', 'push', '-m', message] : ['stash'];
      await execFileAsync('git', args, { cwd, timeout: 15000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git:diff', async (_event, { path, staged }: { path?: string; staged?: boolean }) => {
    const cwd = getWorkspace();
    try {
      const args = staged ? ['diff', '--cached'] : ['diff'];
      if (path) args.push('--', path);
      const { stdout } = await execFileAsync('git', args, { cwd, timeout: 10000 });
      return { success: true, diff: stdout };
    } catch (err: any) {
      return { success: false, error: err.message, diff: '' };
    }
  });

  ipcMain.handle('git:acceptAllChanges', async () => {
    const cwd = getWorkspace();
    try {
      await execFileAsync('git', ['checkout', '--', '.'], { cwd, timeout: 15000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
