export declare enum AuditAction {
    AUTH_LOGIN = "auth:login",
    AUTH_LOGOUT = "auth:logout",
    AUTH_SIGNUP = "auth:signup",
    AUTH_TOKEN_REFRESH = "auth:token_refresh",
    AUTH_LOGIN_FAILED = "auth:login_failed",
    USER_CREATE = "user:create",
    USER_UPDATE = "user:update",
    USER_DELETE = "user:delete",
    USER_ROLE_CHANGE = "user:role_change",
    DATA_READ = "data:read",
    DATA_CREATE = "data:create",
    DATA_UPDATE = "data:update",
    DATA_DELETE = "data:delete",
    DATA_EXPORT = "data:export",
    CONVERSATION_CREATE = "conversation:create",
    CONVERSATION_DELETE = "conversation:delete",
    CONVERSATION_SHARE = "conversation:share",
    SKILL_CREATE = "skill:create",
    SKILL_UPDATE = "skill:update",
    SKILL_DELETE = "skill:delete",
    SETTINGS_CHANGE = "settings:change",
    SYSTEM_CONFIG_CHANGE = "system:config_change",
    SYSTEM_DEPLOY = "system:deploy",
    SYSTEM_BACKUP = "system:backup"
}
export declare enum AuditCategory {
    AUTH = "authentication",
    USER = "user_management",
    DATA = "data_access",
    CONVERSATION = "conversation",
    SKILL = "skill_management",
    SETTINGS = "settings",
    SYSTEM = "system"
}
export declare enum AuditSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface AuditLogEntry {
    id: string;
    timestamp: string;
    action: AuditAction;
    category: AuditCategory;
    severity: AuditSeverity;
    actor: {
        userId: string;
        email: string;
        role: string;
        ip?: string;
        userAgent?: string;
    };
    resource: {
        type: string;
        id: string;
        name?: string;
    };
    details: Record<string, unknown>;
    result: 'success' | 'failure' | 'error';
    errorMessage?: string;
    requestId?: string;
    sessionId?: string;
}
export interface AuditLogFilter {
    startTime?: string;
    endTime?: string;
    actions?: AuditAction[];
    categories?: AuditCategory[];
    severity?: AuditSeverity[];
    userId?: string;
    result?: 'success' | 'failure' | 'error';
    limit?: number;
    offset?: number;
}
export interface AuditLogStats {
    total: number;
    byAction: Record<string, number>;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byResult: Record<string, number>;
    failures: number;
    criticalEvents: number;
}
//# sourceMappingURL=types.d.ts.map