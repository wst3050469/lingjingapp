import type { GitHubAccount } from '../types/github.types.js';
export interface TokenManagerConfig {
    autoRefresh: boolean;
    refreshThreshold: number;
    maxTokenAge: number;
}
export declare class TokenManager {
    private storage;
    private config;
    private refreshTimers;
    constructor(config?: Partial<TokenManagerConfig>);
    saveAccount(account: GitHubAccount): Promise<void>;
    loadAccount(accountId: string): Promise<GitHubAccount | null>;
    loadAllAccounts(): Promise<GitHubAccount[]>;
    deleteAccount(accountId: string): Promise<void>;
    getActiveToken(accountId: string): Promise<string | null>;
    private isTokenExpiring;
    private refreshToken;
    private updateAccountStatus;
    scheduleRefresh(accountId: string, expiresAt: number): void;
    getDeviceId(): Promise<string>;
    setDefaultAccount(accountId: string): Promise<void>;
    getDefaultAccount(): Promise<GitHubAccount | null>;
    destroy(): void;
}
//# sourceMappingURL=token-manager.d.ts.map