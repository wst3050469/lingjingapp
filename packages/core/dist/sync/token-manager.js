import { SecureTokenStorage } from '../electron-deps/secure-storage.js';
import { AccountStatus } from '../types/github.types.js';
const DEFAULT_CONFIG = {
    autoRefresh: true,
    refreshThreshold: 300_000, // 5 minutes
    maxTokenAge: 86_400_000, // 24 hours
};
export class TokenManager {
    storage;
    config;
    refreshTimers = new Map();
    constructor(config = {}) {
        this.storage = new SecureTokenStorage();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    async saveAccount(account) {
        const key = `github_account_${account.id}`;
        this.storage.saveToken(key, JSON.stringify(account));
    }
    async loadAccount(accountId) {
        const key = `github_account_${accountId}`;
        const data = await this.storage.loadToken(key);
        if (!data) {
            return null;
        }
        try {
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    async loadAllAccounts() {
        const keys = this.storage.listKeys('github_account_');
        const accounts = [];
        for (const key of keys) {
            const data = await this.storage.loadToken(key);
            if (data) {
                try {
                    accounts.push(JSON.parse(data));
                }
                catch {
                    // skip corrupted data
                }
            }
        }
        return accounts;
    }
    async deleteAccount(accountId) {
        const key = `github_account_${accountId}`;
        this.storage.deleteToken(key);
        const timer = this.refreshTimers.get(accountId);
        if (timer) {
            clearTimeout(timer);
            this.refreshTimers.delete(accountId);
        }
    }
    async getActiveToken(accountId) {
        const account = await this.loadAccount(accountId);
        if (!account) {
            return null;
        }
        if (account.status !== 'active') {
            return null;
        }
        if (this.isTokenExpiring(account)) {
            if (this.config.autoRefresh && account.refreshToken) {
                const refreshed = await this.refreshToken(account);
                if (refreshed) {
                    return refreshed.accessToken;
                }
            }
            return null;
        }
        return account.accessToken;
    }
    isTokenExpiring(account) {
        if (!account.expiresAt) {
            return false;
        }
        const now = Date.now();
        const threshold = this.config.refreshThreshold;
        return (account.expiresAt - now) < threshold;
    }
    async refreshToken(account) {
        if (!account.refreshToken) {
            return null;
        }
        try {
            console.log(`[TokenManager] Refreshing token for account ${account.username}`);
            // In real Electron context, this would make an API call to refresh the token.
            // For now, just extend the expiry.
            return {
                ...account,
                accessToken: account.accessToken,
                refreshToken: account.refreshToken,
                expiresAt: Date.now() + this.config.maxTokenAge,
            };
        }
        catch (err) {
            console.error(`[TokenManager] Failed to refresh token for ${account.username}:`, err);
            await this.updateAccountStatus(account.id, AccountStatus.EXPIRED);
            return null;
        }
    }
    async updateAccountStatus(accountId, status) {
        const account = await this.loadAccount(accountId);
        if (account) {
            account.status = status;
            await this.saveAccount(account);
        }
    }
    scheduleRefresh(accountId, expiresAt) {
        const existingTimer = this.refreshTimers.get(accountId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const now = Date.now();
        const timeUntilRefresh = expiresAt - now - this.config.refreshThreshold;
        if (timeUntilRefresh > 0) {
            const timer = setTimeout(async () => {
                const account = await this.loadAccount(accountId);
                if (account && account.status === 'active') {
                    await this.refreshToken(account);
                }
                this.refreshTimers.delete(accountId);
            }, timeUntilRefresh);
            this.refreshTimers.set(accountId, timer);
        }
    }
    async getDeviceId() {
        return await this.storage.getDeviceFingerprint();
    }
    async setDefaultAccount(accountId) {
        const accounts = await this.loadAllAccounts();
        for (const account of accounts) {
            account.isDefault = account.id === accountId;
            await this.saveAccount(account);
        }
    }
    async getDefaultAccount() {
        const accounts = await this.loadAllAccounts();
        return accounts.find(a => a.isDefault && a.status === 'active') || null;
    }
    destroy() {
        for (const timer of this.refreshTimers.values()) {
            clearTimeout(timer);
        }
        this.refreshTimers.clear();
    }
}
//# sourceMappingURL=token-manager.js.map