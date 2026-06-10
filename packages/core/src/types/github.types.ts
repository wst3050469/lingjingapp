// GitHub OAuth types

export enum AccountStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  PENDING = 'pending',
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

export const DEFAULT_GITHUB_OAUTH_CONFIG: Required<OAuthConfig> = {
  redirectUri: 'lingjing://github/callback',
  scope: ['repo', 'user', 'gist'],
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  apiUrl: 'https://api.github.com',
  clientId: '',
  clientSecret: '',
};
