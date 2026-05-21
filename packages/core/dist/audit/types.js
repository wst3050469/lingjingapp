export var AuditAction;
(function (AuditAction) {
    AuditAction["AUTH_LOGIN"] = "auth:login";
    AuditAction["AUTH_LOGOUT"] = "auth:logout";
    AuditAction["AUTH_SIGNUP"] = "auth:signup";
    AuditAction["AUTH_TOKEN_REFRESH"] = "auth:token_refresh";
    AuditAction["AUTH_LOGIN_FAILED"] = "auth:login_failed";
    AuditAction["USER_CREATE"] = "user:create";
    AuditAction["USER_UPDATE"] = "user:update";
    AuditAction["USER_DELETE"] = "user:delete";
    AuditAction["USER_ROLE_CHANGE"] = "user:role_change";
    AuditAction["DATA_READ"] = "data:read";
    AuditAction["DATA_CREATE"] = "data:create";
    AuditAction["DATA_UPDATE"] = "data:update";
    AuditAction["DATA_DELETE"] = "data:delete";
    AuditAction["DATA_EXPORT"] = "data:export";
    AuditAction["CONVERSATION_CREATE"] = "conversation:create";
    AuditAction["CONVERSATION_DELETE"] = "conversation:delete";
    AuditAction["CONVERSATION_SHARE"] = "conversation:share";
    AuditAction["SKILL_CREATE"] = "skill:create";
    AuditAction["SKILL_UPDATE"] = "skill:update";
    AuditAction["SKILL_DELETE"] = "skill:delete";
    AuditAction["SETTINGS_CHANGE"] = "settings:change";
    AuditAction["SYSTEM_CONFIG_CHANGE"] = "system:config_change";
    AuditAction["SYSTEM_DEPLOY"] = "system:deploy";
    AuditAction["SYSTEM_BACKUP"] = "system:backup";
})(AuditAction || (AuditAction = {}));
export var AuditCategory;
(function (AuditCategory) {
    AuditCategory["AUTH"] = "authentication";
    AuditCategory["USER"] = "user_management";
    AuditCategory["DATA"] = "data_access";
    AuditCategory["CONVERSATION"] = "conversation";
    AuditCategory["SKILL"] = "skill_management";
    AuditCategory["SETTINGS"] = "settings";
    AuditCategory["SYSTEM"] = "system";
})(AuditCategory || (AuditCategory = {}));
export var AuditSeverity;
(function (AuditSeverity) {
    AuditSeverity["LOW"] = "low";
    AuditSeverity["MEDIUM"] = "medium";
    AuditSeverity["HIGH"] = "high";
    AuditSeverity["CRITICAL"] = "critical";
})(AuditSeverity || (AuditSeverity = {}));
//# sourceMappingURL=types.js.map