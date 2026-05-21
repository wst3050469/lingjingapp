export var Role;
(function (Role) {
    Role["SUPER_ADMIN"] = "super_admin";
    Role["ADMIN"] = "admin";
    Role["MANAGER"] = "manager";
    Role["MEMBER"] = "member";
    Role["VIEWER"] = "viewer";
    Role["GUEST"] = "guest";
})(Role || (Role = {}));
export var Permission;
(function (Permission) {
    Permission["AUTH_LOGIN"] = "auth:login";
    Permission["AUTH_MANAGE"] = "auth:manage";
    Permission["USER_READ"] = "user:read";
    Permission["USER_CREATE"] = "user:create";
    Permission["USER_UPDATE"] = "user:update";
    Permission["USER_DELETE"] = "user:delete";
    Permission["USER_ROLE_ASSIGN"] = "user:role:assign";
    Permission["CONVERSATION_READ"] = "conversation:read";
    Permission["CONVERSATION_CREATE"] = "conversation:create";
    Permission["CONVERSATION_UPDATE"] = "conversation:update";
    Permission["CONVERSATION_DELETE"] = "conversation:delete";
    Permission["CONVERSATION_SHARE"] = "conversation:share";
    Permission["SKILL_READ"] = "skill:read";
    Permission["SKILL_CREATE"] = "skill:create";
    Permission["SKILL_UPDATE"] = "skill:update";
    Permission["SKILL_DELETE"] = "skill:delete";
    Permission["MEMORY_READ"] = "memory:read";
    Permission["MEMORY_WRITE"] = "memory:write";
    Permission["MEMORY_DELETE"] = "memory:delete";
    Permission["SETTINGS_READ"] = "settings:read";
    Permission["SETTINGS_WRITE"] = "settings:write";
    Permission["SYSTEM_CONFIG"] = "system:config";
    Permission["SYSTEM_DEPLOY"] = "system:deploy";
    Permission["SYSTEM_AUDIT"] = "system:audit";
    Permission["SYSTEM_BACKUP"] = "system:backup";
    Permission["AGENT_EXECUTE"] = "agent:execute";
    Permission["TOOL_EXECUTE"] = "tool:execute";
    Permission["DATA_EXPORT"] = "data:export";
    Permission["DATA_IMPORT"] = "data:import";
})(Permission || (Permission = {}));
export const ROLE_PERMISSIONS = {
    [Role.SUPER_ADMIN]: Object.values(Permission),
    [Role.ADMIN]: [
        Permission.AUTH_LOGIN,
        Permission.AUTH_MANAGE,
        Permission.USER_READ,
        Permission.USER_CREATE,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        Permission.USER_ROLE_ASSIGN,
        Permission.CONVERSATION_READ,
        Permission.CONVERSATION_CREATE,
        Permission.CONVERSATION_UPDATE,
        Permission.CONVERSATION_DELETE,
        Permission.CONVERSATION_SHARE,
        Permission.SKILL_READ,
        Permission.SKILL_CREATE,
        Permission.SKILL_UPDATE,
        Permission.SKILL_DELETE,
        Permission.MEMORY_READ,
        Permission.MEMORY_WRITE,
        Permission.MEMORY_DELETE,
        Permission.SETTINGS_READ,
        Permission.SETTINGS_WRITE,
        Permission.SYSTEM_AUDIT,
        Permission.SYSTEM_BACKUP,
        Permission.AGENT_EXECUTE,
        Permission.TOOL_EXECUTE,
        Permission.DATA_EXPORT,
        Permission.DATA_IMPORT,
    ],
    [Role.MANAGER]: [
        Permission.AUTH_LOGIN,
        Permission.USER_READ,
        Permission.CONVERSATION_READ,
        Permission.CONVERSATION_CREATE,
        Permission.CONVERSATION_UPDATE,
        Permission.CONVERSATION_DELETE,
        Permission.CONVERSATION_SHARE,
        Permission.SKILL_READ,
        Permission.SKILL_CREATE,
        Permission.SKILL_UPDATE,
        Permission.MEMORY_READ,
        Permission.MEMORY_WRITE,
        Permission.SETTINGS_READ,
        Permission.AGENT_EXECUTE,
        Permission.TOOL_EXECUTE,
        Permission.DATA_EXPORT,
    ],
    [Role.MEMBER]: [
        Permission.AUTH_LOGIN,
        Permission.USER_READ,
        Permission.CONVERSATION_READ,
        Permission.CONVERSATION_CREATE,
        Permission.CONVERSATION_UPDATE,
        Permission.CONVERSATION_DELETE,
        Permission.SKILL_READ,
        Permission.SKILL_CREATE,
        Permission.MEMORY_READ,
        Permission.MEMORY_WRITE,
        Permission.SETTINGS_READ,
        Permission.AGENT_EXECUTE,
        Permission.TOOL_EXECUTE,
    ],
    [Role.VIEWER]: [
        Permission.AUTH_LOGIN,
        Permission.USER_READ,
        Permission.CONVERSATION_READ,
        Permission.SKILL_READ,
        Permission.MEMORY_READ,
        Permission.SETTINGS_READ,
    ],
    [Role.GUEST]: [
        Permission.AUTH_LOGIN,
        Permission.CONVERSATION_READ,
        Permission.SKILL_READ,
    ],
};
//# sourceMappingURL=types.js.map