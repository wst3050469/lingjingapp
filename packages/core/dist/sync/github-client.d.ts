import { TokenManager } from './token-manager.js';
import type { GitHubAccount, GitHubUser, GitHubRepository, OAuthConfig } from '../types/github.types.js';
export declare class GitHubClient {
    private tokenManager;
    private oauthConfig;
    private pendingStates;
    constructor(tokenManager: TokenManager, oauthConfig?: Partial<OAuthConfig>);
    generateAuthUrl(scopes?: string[]): {
        url: string;
        state: string;
    };
    handleCallback(code: string, state: string): Promise<GitHubAccount>;
    fetchUser(accessToken?: string): Promise<GitHubUser>;
    fetchRepositories(accessToken?: string): Promise<GitHubRepository[]>;
    createRepository(name: string, options?: {
        description?: string;
        private?: boolean;
        autoInit?: boolean;
    }, accessToken?: string): Promise<GitHubRepository>;
    getFileContent(owner: string, repo: string, path: string, ref?: string, accessToken?: string): Promise<{
        content: string;
        sha: string;
    }>;
    createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, sha?: string, accessToken?: string): Promise<{
        content: any;
        commit: any;
    }>;
    private getDefaultToken;
    listAccounts(): Promise<GitHubAccount[]>;
    switchAccount(accountId: string): Promise<void>;
    removeAccount(accountId: string): Promise<void>;
}
//# sourceMappingURL=github-client.d.ts.map