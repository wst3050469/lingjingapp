import { createHash, randomBytes } from 'node:crypto';
import { githubClient } from '../electron-deps/http-client.js';
import { DEFAULT_GITHUB_OAUTH_CONFIG, AccountStatus } from '../types/github.types.js';
export class GitHubClient {
    tokenManager;
    oauthConfig;
    pendingStates = new Map();
    constructor(tokenManager, oauthConfig = {}) {
        this.tokenManager = tokenManager;
        this.oauthConfig = {
            ...DEFAULT_GITHUB_OAUTH_CONFIG,
            clientId: oauthConfig.clientId || process.env.GITHUB_CLIENT_ID || '',
            clientSecret: oauthConfig.clientSecret || process.env.GITHUB_CLIENT_SECRET || '',
            ...oauthConfig,
        };
    }
    generateAuthUrl(scopes) {
        const state = randomBytes(32).toString('hex');
        const codeVerifier = randomBytes(32).toString('base64url');
        const oauthState = {
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
    async handleCallback(code, state) {
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
        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
            throw new Error(`GitHub OAuth error: ${tokenData.error}`);
        }
        const user = await this.fetchUser(tokenData.access_token);
        const account = {
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
    async fetchUser(accessToken) {
        const token = accessToken || await this.getDefaultToken();
        if (!token) {
            throw new Error('No GitHub token available');
        }
        return githubClient.get('/user', {
            headers: { Authorization: `Bearer ${token}` },
        });
    }
    async fetchRepositories(accessToken) {
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
    async createRepository(name, options = {}, accessToken) {
        const token = accessToken || await this.getDefaultToken();
        if (!token) {
            throw new Error('No GitHub token available');
        }
        return githubClient.post('/user/repos', {
            name,
            description: options.description,
            private: options.private || false,
            auto_init: options.autoInit || true,
        }, {
            headers: { Authorization: `Bearer ${token}` },
        });
    }
    async getFileContent(owner, repo, path, ref, accessToken) {
        const token = accessToken || await this.getDefaultToken();
        if (!token) {
            throw new Error('No GitHub token available');
        }
        const url = `/repos/${owner}/${repo}/contents/${path}`;
        const params = ref ? { ref } : {};
        const response = await githubClient.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params,
        });
        return {
            content: Buffer.from(response.content, 'base64').toString('utf-8'),
            sha: response.sha,
        };
    }
    async createOrUpdateFile(owner, repo, path, content, message, sha, accessToken) {
        const token = accessToken || await this.getDefaultToken();
        if (!token) {
            throw new Error('No GitHub token available');
        }
        const url = `/repos/${owner}/${repo}/contents/${path}`;
        const body = {
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
    async getDefaultToken() {
        const account = await this.tokenManager.getDefaultAccount();
        if (!account)
            return null;
        return this.tokenManager.getActiveToken(account.id);
    }
    async listAccounts() {
        return this.tokenManager.loadAllAccounts();
    }
    async switchAccount(accountId) {
        await this.tokenManager.setDefaultAccount(accountId);
    }
    async removeAccount(accountId) {
        await this.tokenManager.deleteAccount(accountId);
    }
}
//# sourceMappingURL=github-client.js.map