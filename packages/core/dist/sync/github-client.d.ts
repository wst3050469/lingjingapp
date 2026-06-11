import type { OAuthConfig, GitHubAccount } from '../types/github.types.js';
import type { TokenManager } from './token-manager.js';
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
    fetchUser(accessToken?: string): Promise<any>;
    fetchRepositories(accessToken?: string): Promise<any[]>;
    createRepository(name: string, options?: {
        description?: string;
        private?: boolean;
        autoInit?: boolean;
    }, accessToken?: string): Promise<any>;
    getFileContent(owner: string, repo: string, path: string, ref?: string, accessToken?: string): Promise<{
        content: string;
        sha: string;
    }>;
    createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, sha?: string, accessToken?: string): Promise<any>;
    getDefaultToken(): Promise<string | null>;
    listAccounts(): Promise<GitHubAccount[]>;
    switchAccount(accountId: string): Promise<void>;
    removeAccount(accountId: string): Promise<void>;
}
//# sourceMappingURL=github-client.d.ts.map