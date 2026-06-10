import { ipcMain } from 'electron';
// @ts-ignore -- GitHubRepository/GitHubUser not yet exported from @codepilot/core/types
import type { GitHubAccount, GitHubRepository, GitHubUser } from '@codepilot/core/types';
// @ts-ignore - runtime import
import { TokenManager } from '@codepilot/core/sync/token-manager';
import { GitHubClient } from '@codepilot/core/sync/github-client';

let githubClient: any = null;
let tokenManager: any = null;

export function initGitHubIpc(): void {
  tokenManager = new TokenManager();
  githubClient = new GitHubClient(tokenManager);

  ipcMain.handle('github:generate-auth-url', async (_event, scopes?: string[]) => {
    if (!githubClient) {
      throw new Error('GitHubClient not initialized');
    }
    return githubClient.generateAuthUrl(scopes);
  });

  ipcMain.handle('github:handle-callback', async (_event, code: string, state: string) => {
    if (!githubClient) {
      throw new Error('GitHubClient not initialized');
    }
    return githubClient.handleCallback(code, state);
  });

  ipcMain.handle('github:get-user', async (): Promise<GitHubUser> => {
    if (!githubClient) {
      throw new Error('GitHubClient not initialized');
    }
    return githubClient.fetchUser();
  });

  ipcMain.handle('github:get-repositories', async (): Promise<GitHubRepository[]> => {
    if (!githubClient) {
      throw new Error('GitHubClient not initialized');
    }
    return githubClient.fetchRepositories();
  });

  ipcMain.handle('github:create-repository', async (_event, name: string, options?: any) => {
    if (!githubClient) {
      throw new Error('GitHubClient not initialized');
    }
    return githubClient.createRepository(name, options);
  });

  ipcMain.handle('github:get-file', async (_event, owner: string, repo: string, path: string, ref?: string) => {
    if (!githubClient) {
      throw new Error('GitHubClient not initialized');
    }
    return githubClient.getFileContent(owner, repo, path, ref);
  });

  ipcMain.handle('github:put-file', async (
    _event,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ) => {
    if (!githubClient) {
      throw new Error('GitHubClient not initialized');
    }
    return githubClient.createOrUpdateFile(owner, repo, path, content, message, sha);
  });

  ipcMain.handle('github:list-accounts', async (): Promise<GitHubAccount[]> => {
    if (!githubClient) {
      throw new Error('GitHubClient not initialized');
    }
    return githubClient.listAccounts();
  });

  ipcMain.handle('github:switch-account', async (_event, accountId: string) => {
    if (!githubClient) {
      throw new Error('GitHubClient not initialized');
    }
    return githubClient.switchAccount(accountId);
  });

  ipcMain.handle('github:remove-account', async (_event, accountId: string) => {
    if (!githubClient) {
      throw new Error('GitHubClient not initialized');
    }
    return githubClient.removeAccount(accountId);
  });

  ipcMain.handle('github:get-saved-token', async (_event, accountId: string) => {
    if (!tokenManager) {
      throw new Error('TokenManager not initialized');
    }
    const account = await tokenManager.loadAccount(accountId);
    return account?.accessToken || null;
  });
}

export function getGitHubClient(): GitHubClient | null {
  return githubClient;
}

export function getTokenManager(): TokenManager | null {
  return tokenManager;
}
