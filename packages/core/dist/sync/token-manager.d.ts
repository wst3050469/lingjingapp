import { AccountStatus } from '../types/github.types.js';
import type { GitHubAccount } from '../types/github.types.js';
interface TokenManagerConfig {
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
    isTokenExpiring(account: GitHubAccount): boolean;
    refreshToken(account: GitHubAccount): Promise<GitHubAccount | null>;
    updateAccountStatus(accountId: string, status: AccountStatus): Promise<void>;
    scheduleRefresh(accountId: string, expiresAt: number): void;
    getDeviceId(): Promise<string>;
    setDefaultAccount(accountId: string): Promise<void>;
    getDefaultAccount(): Promise<GitHubAccount | null>;
    destroy(): void;
}
export {};
//# sourceMappingURL=token-manager.d.ts.map