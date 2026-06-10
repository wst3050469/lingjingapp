import { createHash, randomBytes } from 'node:crypto';
import { githubClient } from '../electron-deps/http-client.js';
import { DEFAULT_GITHUB_OAUTH_CONFIG, AccountStatus } from '../types/github.types.js';
import type { OAuthConfig, GitHubAccount } from '../types/github.types.js';
import type { TokenManager } from './token-manager.js';

interface PendingOAuthState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
  expiresAt: number;
}

export class GitHubClient {
  private tokenManager: TokenManager;
  private oauthConfig: Required<OAuthConfig>;
  private pendingStates = new Map<string, PendingOAuthState>();

  constructor(tokenManager: TokenManager, oauthConfig: Partial<OAuthConfig> = {}) {
    this.tokenManager = tokenManager;
    this.oauthConfig = {
      ...DEFAULT_GITHUB_OAUTH_CONFIG,
      clientId: oauthConfig.clientId || process.env.GITHUB_CLIENT_ID || '',
      clientSecret: oauthConfig.clientSecret || process.env.GITHUB_CLIENT_SECRET || '',
      ...oauthConfig,
    } as Required<OAuthConfig>;
  }

  generateAuthUrl(scopes?: string[]): { url: string; state: string } {
    const state = randomBytes(32).toString('hex');
    const codeVerifier = randomBytes(32).toString('base64url');

    const oauthState: PendingOAuthState = {
      state,
      codeVerifier,
      redirectUri: this.oauthConfig.redirectUri,
      createdAt: Date.now(),
      expiresAt: Date.now() + 600_000, // 10 minutes
    };
    this.pendingStates.set(state, oauthState);

    const scope = (scopes || this.oauthConfig.scope).join(' ');
    const url = new URL(this.oauthConfig.authorizationUrl);
    url.searchParams.set('client_id', this.oauthConfig.clientId);
    url.searchParams.set('redirect_uri', this.oauthConfig.redirectUri);
    url.searchParams.set('scope', scope);
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');

    return { url: url.toString(), state };
  }

  async handleCallback(code: string, state: string): Promise<GitHubAccount> {
    const oauthState = this.pendingStates.get(state);
    if (!oauthState) {
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }
    if (Date.now() > oauthState.expiresAt) {
      this.pendingStates.delete(state);
      throw new Error('OAuth state expired');
    }
    this.pendingStates.delete(state);

    const tokenResponse = await fetch(this.oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        code,
        redirect_uri: oauthState.redirectUri,
        state,
      }),
    });

    const tokenData = await tokenResponse.json() as any;
    if (tokenData.error) {
      throw new Error(`GitHub OAuth error: ${tokenData.error}`);
    }

    const user = await this.fetchUser(tokenData.access_token) as any;

    const account: GitHubAccount = {
      id: createHash('sha256').update(user.login).digest('hex'),
      username: user.login,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || 'bearer',
      scope: tokenData.scope?.split(',') || this.oauthConfig.scope,
      expiresAt: tokenData.expires_in
        ? Date.now() + tokenData.expires_in * 1000
        : undefined,
      status: AccountStatus.ACTIVE,
      addedAt: Date.now(),
      isDefault: false,
      avatarUrl: user.avatar_url,
    };

    await this.tokenManager.saveAccount(account);
    if (account.expiresAt) {
      this.tokenManager.scheduleRefresh(account.id, account.expiresAt);
    }

    return account;
  }

  async fetchUser(accessToken?: string): Promise<any> {
    const token = accessToken || await this.getDefaultToken();
    if (!token) {
      throw new Error('No GitHub token available');
    }
    return githubClient.get('/user', {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async fetchRepositories(accessToken?: string): Promise<any[]> {
    const token = accessToken || await this.getDefaultToken();
    if (!token) {
      throw new Error('No GitHub token available');
    }
    return githubClient.get('/user/repos', {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        sort: 'updated',
        per_page: 100,
      },
    });
  }

  async createRepository(
    name: string,
    options: { description?: string; private?: boolean; autoInit?: boolean } = {},
    accessToken?: string,
  ): Promise<any> {
    const token = accessToken || await this.getDefaultToken();
    if (!token) {
      throw new Error('No GitHub token available');
    }
    return githubClient.post(
      '/user/repos',
      {
        name,
        description: options.description,
        private: options.private || false,
        auto_init: options.autoInit || true,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
    accessToken?: string,
  ): Promise<{ content: string; sha: string }> {
    const token = accessToken || await this.getDefaultToken();
    if (!token) {
      throw new Error('No GitHub token available');
    }
    const url = `/repos/${owner}/${repo}/contents/${path}`;
    const params: Record<string, string> = ref ? { ref } : {};
    const response = await githubClient.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    }) as any;

    return {
      content: Buffer.from(response.content, 'base64').toString('utf-8'),
      sha: response.sha,
    };
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
    accessToken?: string,
  ): Promise<any> {
    const token = accessToken || await this.getDefaultToken();
    if (!token) {
      throw new Error('No GitHub token available');
    }
    const url = `/repos/${owner}/${repo}/contents/${path}`;
    const body: Record<string, string> = {
      message,
      content: Buffer.from(content).toString('base64'),
    };
    if (sha) {
      body.sha = sha;
    }
    return githubClient.put(url, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async getDefaultToken(): Promise<string | null> {
    const account = await this.tokenManager.getDefaultAccount();
    if (!account) return null;
    return this.tokenManager.getActiveToken(account.id);
  }

  async listAccounts(): Promise<GitHubAccount[]> {
    return this.tokenManager.loadAllAccounts();
  }

  async switchAccount(accountId: string): Promise<void> {
    await this.tokenManager.setDefaultAccount(accountId);
  }

  async removeAccount(accountId: string): Promise<void> {
    await this.tokenManager.deleteAccount(accountId);
  }
}
