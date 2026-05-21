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
    lastUsedAt?: number;
    isDefault: boolean;
    avatarUrl?: string;
}
export interface OAuthState {
    state: string;
    codeVerifier: string;
    redirectUri: string;
    createdAt: number;
    expiresAt: number;
}
export interface GitHubUser {
    id: number;
    login: string;
    name?: string;
    email?: string;
    avatar_url: string;
    bio?: string;
    company?: string;
    location?: string;
    blog?: string;
    public_repos: number;
    followers: number;
    following: number;
    created_at: string;
    updated_at: string;
}
export interface GitHubRepository {
    id: number;
    name: string;
    full_name: string;
    owner: {
        login: string;
        id: number;
        avatar_url: string;
    };
    description?: string;
    private: boolean;
    fork: boolean;
    html_url: string;
    clone_url: string;
    ssh_url: string;
    stars: number;
    forks: number;
    watchers: number;
    open_issues: number;
    default_branch: string;
    created_at: string;
    updated_at: string;
    pushed_at: string;
    permissions?: {
        admin: boolean;
        push: boolean;
        pull: boolean;
    };
}
export interface TokenRefreshResult {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    tokenType: string;
    scope: string[];
}
export interface OAuthConfig {
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    scope: string[];
    authorizationUrl: string;
    tokenUrl: string;
    apiUrl: string;
}
export declare const DEFAULT_GITHUB_OAUTH_CONFIG: Omit<OAuthConfig, 'clientId' | 'clientSecret'>;
//# sourceMappingURL=github.types.d.ts.map