// GitHub OAuth types
export var AccountStatus;
(function (AccountStatus) {
    AccountStatus["ACTIVE"] = "active";
    AccountStatus["EXPIRED"] = "expired";
    AccountStatus["REVOKED"] = "revoked";
    AccountStatus["PENDING"] = "pending";
})(AccountStatus || (AccountStatus = {}));
export const DEFAULT_GITHUB_OAUTH_CONFIG = {
    redirectUri: 'lingjing://github/callback',
    scope: ['repo', 'user', 'gist'],
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    apiUrl: 'https://api.github.com',
    clientId: '',
    clientSecret: '',
};
//# sourceMappingURL=github.types.js.map