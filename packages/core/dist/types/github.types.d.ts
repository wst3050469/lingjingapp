export declare enum AccountStatus {
    ACTIVE = "active",
    EXPIRED = "expired",
    REVOKED = "revoked",
    PENDING = "pending"
}
export interface GitHubAccount {
    id: string;
    username: string;
    accessToken: string;
    refreshToken?: string;
    tokenType: string;
    scope: string[];
    expiresAt?: number;
    status: AccountStatus;
    addedAt: number;
    isDefault: boolean;
    avatarUrl?: string;
}
export interface OAuthConfig {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    scope?: string[];
    authorizationUrl?: string;
    tokenUrl?: string;
    apiUrl?: string;
}
export declare const DEFAULT_GITHUB_OAUTH_CONFIG: Required<OAuthConfig>;
//# sourceMappingURL=github.types.d.ts.map