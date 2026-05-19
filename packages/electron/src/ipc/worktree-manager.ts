// Worktree Manager - creates and manages git worktrees for isolated quest execution

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, basename } from 'node:path';
import { rm, access } from 'node:fs/promises';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  path: string;
  branch: string;
  taskId: string;
}

/**
 * Create a git worktree for isolated task execution.
 * Creates a new branch from the current HEAD and sets up a worktree directory.
 */
export async function createWorktree(
  repoRoot: string,
  taskId: string
): Promise<{ worktreePath: string; branchName: string }> {
  const sanitizedId = taskId.replace(/[^a-zA-Z0-9-]/g, '-');
  const branchName = `quest/${sanitizedId}`;
  const worktreePath = join(repoRoot, '..', `.quest-worktree-${sanitizedId}`);

  // Create worktree with a new branch from current HEAD
  await execFileAsync(
    'git',
    ['worktree', 'add', '-b', branchName, worktreePath],
    { cwd: repoRoot, timeout: 15000 }
  );

  return { worktreePath, branchName };
}

/**
 * Remove a git worktree and its associated branch.
 */
export async function removeWorktree(
  repoRoot: string,
  worktreePath: string,
  branchName?: string
): Promise<void> {
  try {
    // Remove the worktree
    await execFileAsync(
      'git',
      ['worktree', 'remove', worktreePath, '--force'],
      { cwd: repoRoot, timeout: 10000 }
    );
  } catch {
    // If git worktree remove fails, try manual cleanup
    try {
      await rm(worktreePath, { recursive: true, force: true });
      await execFileAsync(
        'git',
        ['worktree', 'prune'],
        { cwd: repoRoot, timeout: 5000 }
      );
    } catch { /* ignore */ }
  }

  // Optionally delete the branch
  if (branchName) {
    try {
      await execFileAsync(
        'git',
        ['branch', '-D', branchName],
        { cwd: repoRoot, timeout: 5000 }
      );
    } catch { /* ignore - branch might not exist */ }
  }
}

/**
 * List all quest-related worktrees.
 */
export async function listWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['worktree', 'list', '--porcelain'],
      { cwd: repoRoot, timeout: 5000 }
    );

    const worktrees: WorktreeInfo[] = [];
    const blocks = stdout.split('\n\n').filter(Boolean);

    for (const block of blocks) {
      const lines = block.split('\n');
      const pathLine = lines.find(l => l.startsWith('worktree '));
      const branchLine = lines.find(l => l.startsWith('branch '));

      if (pathLine && branchLine) {
        const path = pathLine.replace('worktree ', '');
        const branch = branchLine.replace('branch refs/heads/', '');

        // Only include quest-related worktrees
        if (branch.startsWith('quest/')) {
          const taskId = branch.replace('quest/', '');
          worktrees.push({ path, branch, taskId });
        }
      }
    }

    return worktrees;
  } catch {
    return [];
  }
}

/**
 * Merge worktree changes back to the source branch.
 */
export async function mergeWorktreeChanges(
  repoRoot: string,
  branchName: string,
  message?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const commitMessage = message || `Quest: merge changes from ${branchName}`;

    // Merge the quest branch into the current branch
    await execFileAsync(
      'git',
      ['merge', branchName, '--no-ff', '-m', commitMessage],
      { cwd: repoRoot, timeout: 15000 }
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if the workspace is a git repository.
 */
export async function isGitRepo(path: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: path, timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
