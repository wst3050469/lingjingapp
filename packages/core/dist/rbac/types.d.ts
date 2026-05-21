export declare enum Role {
    SUPER_ADMIN = "super_admin",
    ADMIN = "admin",
    MANAGER = "manager",
    MEMBER = "member",
    VIEWER = "viewer",
    GUEST = "guest"
}
export declare enum Permission {
    AUTH_LOGIN = "auth:login",
    AUTH_MANAGE = "auth:manage",
    USER_READ = "user:read",
    USER_CREATE = "user:create",
    USER_UPDATE = "user:update",
    USER_DELETE = "user:delete",
    USER_ROLE_ASSIGN = "user:role:assign",
    CONVERSATION_READ = "conversation:read",
    CONVERSATION_CREATE = "conversation:create",
    CONVERSATION_UPDATE = "conversation:update",
    CONVERSATION_DELETE = "conversation:delete",
    CONVERSATION_SHARE = "conversation:share",
    SKILL_READ = "skill:read",
    SKILL_CREATE = "skill:create",
    SKILL_UPDATE = "skill:update",
    SKILL_DELETE = "skill:delete",
    MEMORY_READ = "memory:read",
    MEMORY_WRITE = "memory:write",
    MEMORY_DELETE = "memory:delete",
    SETTINGS_READ = "settings:read",
    SETTINGS_WRITE = "settings:write",
    SYSTEM_CONFIG = "system:config",
    SYSTEM_DEPLOY = "system:deploy",
    SYSTEM_AUDIT = "system:audit",
    SYSTEM_BACKUP = "system:backup",
    AGENT_EXECUTE = "agent:execute",
    TOOL_EXECUTE = "tool:execute",
    DATA_EXPORT = "data:export",
    DATA_IMPORT = "data:import"
}
export declare const ROLE_PERMISSIONS: Record<Role, Permission[]>;
export interface UserInfo {
    id: string;
    email: string;
    role: Role;
    tenantId?: string;
}
//# sourceMappingURL=types.d.ts.map