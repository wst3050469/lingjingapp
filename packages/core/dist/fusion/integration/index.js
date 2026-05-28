"use strict";
/**
 * Fusion Integration Module — Batch A + B
 *
 * Batch A (P0 Core Integration):
 * - patch-electron-main.ts → Electron main process initialization
 * - patch-database.ts      → Database migration registration
 * - patch-agent.ts         → Agent loop hook/event injection
 *
 * Batch B (P0 Tool Registration + Skills Registration + Memory Linkage):
 * - patch-tools.ts         → Fusion tool registration
 * - patch-skills.ts        → Fusion skills registration
 * - patch-memory.ts        → Memory event linkages
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAllQuotas = exports.checkQuota = exports.getCurrentUsage = exports.reportUsage = exports.getTenantQuota = exports.setTenantQuota = exports.DEFAULT_QUOTAS = exports.verifyDegradation = exports.runFusionHealthCheck = exports.createAuditMiddleware = exports.getAuditLogCount = exports.clearAuditLogs = exports.queryAuditLogs = exports.createAuditLog = exports.createRBACMiddleware = exports.extractRoleFromToken = exports.checkPermission = exports.RBAC_PERMISSIONS = exports.RBAC_ROLES = exports.LUA_GLOBE_SYNC = exports.LUA_FRAME_EXPORT = exports.patchOpenSpaceIntegration = exports.detectOpenSpaceLinux = exports.detectOpenSpaceWindows = exports.detectOpenSpace = exports.setupMemoryLinkages = exports.registerFusionSkills = exports.registerFusionTools = exports.patchAgentHooks = exports.getMigration004SQL = exports.getMigration003SQL = exports.patchElectronMain = void 0;
var patch_electron_main_js_1 = require("./patch-electron-main.js");
Object.defineProperty(exports, "patchElectronMain", { enumerable: true, get: function () { return patch_electron_main_js_1.patchElectronMain; } });
var patch_database_js_1 = require("./patch-database.js");
Object.defineProperty(exports, "getMigration003SQL", { enumerable: true, get: function () { return patch_database_js_1.getMigration003SQL; } });
Object.defineProperty(exports, "getMigration004SQL", { enumerable: true, get: function () { return patch_database_js_1.getMigration004SQL; } });
var patch_agent_js_1 = require("./patch-agent.js");
Object.defineProperty(exports, "patchAgentHooks", { enumerable: true, get: function () { return patch_agent_js_1.patchAgentHooks; } });
var patch_tools_js_1 = require("./patch-tools.js");
Object.defineProperty(exports, "registerFusionTools", { enumerable: true, get: function () { return patch_tools_js_1.registerFusionTools; } });
var patch_skills_js_1 = require("./patch-skills.js");
Object.defineProperty(exports, "registerFusionSkills", { enumerable: true, get: function () { return patch_skills_js_1.registerFusionSkills; } });
var patch_memory_js_1 = require("./patch-memory.js");
Object.defineProperty(exports, "setupMemoryLinkages", { enumerable: true, get: function () { return patch_memory_js_1.setupMemoryLinkages; } });
/**
 * Batch C (P1 Renderer UI路由注册 + scifi-dark主题切换 + OpenSpace集成完善):
 * - patch-renderer.tsx     → Fusion/OpenSpace 侧栏面板注册 + 懒加载组件映射
 * - patch-theme-switch.tsx → scifi-dark 主题选项 + CSS变量 + 主题选择菜单
 * - patch-openspace.ts     → OpenSpace 路径检测 + WebSocket/窗口嵌入说明 + Lua脚本
 */
var patch_openspace_js_1 = require("./patch-openspace.js");
Object.defineProperty(exports, "detectOpenSpace", { enumerable: true, get: function () { return patch_openspace_js_1.detectOpenSpace; } });
Object.defineProperty(exports, "detectOpenSpaceWindows", { enumerable: true, get: function () { return patch_openspace_js_1.detectOpenSpaceWindows; } });
Object.defineProperty(exports, "detectOpenSpaceLinux", { enumerable: true, get: function () { return patch_openspace_js_1.detectOpenSpaceLinux; } });
Object.defineProperty(exports, "patchOpenSpaceIntegration", { enumerable: true, get: function () { return patch_openspace_js_1.patchOpenSpaceIntegration; } });
Object.defineProperty(exports, "LUA_FRAME_EXPORT", { enumerable: true, get: function () { return patch_openspace_js_1.LUA_FRAME_EXPORT; } });
Object.defineProperty(exports, "LUA_GLOBE_SYNC", { enumerable: true, get: function () { return patch_openspace_js_1.LUA_GLOBE_SYNC; } });
/**
 * Batch D (P1 Cloud Server RBAC + Audit Log + Health Check + Degradation Test + Tenant Quota):
 * - patch-cloud-rbac.ts    → RBAC roles, permissions, JWT middleware
 * - patch-audit-log.ts     → Audit log entry, query, API middleware
 * - health-check.ts        → Fusion module health check → FusionHealthReport
 * - degradation-test.ts    → Degradation verification → DegradationReport
 * - patch-tenant-quota.ts  → Tenant resource quotas + check
 */
var patch_cloud_rbac_js_1 = require("./patch-cloud-rbac.js");
Object.defineProperty(exports, "RBAC_ROLES", { enumerable: true, get: function () { return patch_cloud_rbac_js_1.RBAC_ROLES; } });
Object.defineProperty(exports, "RBAC_PERMISSIONS", { enumerable: true, get: function () { return patch_cloud_rbac_js_1.RBAC_PERMISSIONS; } });
Object.defineProperty(exports, "checkPermission", { enumerable: true, get: function () { return patch_cloud_rbac_js_1.checkPermission; } });
Object.defineProperty(exports, "extractRoleFromToken", { enumerable: true, get: function () { return patch_cloud_rbac_js_1.extractRoleFromToken; } });
Object.defineProperty(exports, "createRBACMiddleware", { enumerable: true, get: function () { return patch_cloud_rbac_js_1.createRBACMiddleware; } });
var patch_audit_log_js_1 = require("./patch-audit-log.js");
Object.defineProperty(exports, "createAuditLog", { enumerable: true, get: function () { return patch_audit_log_js_1.createAuditLog; } });
Object.defineProperty(exports, "queryAuditLogs", { enumerable: true, get: function () { return patch_audit_log_js_1.queryAuditLogs; } });
Object.defineProperty(exports, "clearAuditLogs", { enumerable: true, get: function () { return patch_audit_log_js_1.clearAuditLogs; } });
Object.defineProperty(exports, "getAuditLogCount", { enumerable: true, get: function () { return patch_audit_log_js_1.getAuditLogCount; } });
Object.defineProperty(exports, "createAuditMiddleware", { enumerable: true, get: function () { return patch_audit_log_js_1.createAuditMiddleware; } });
var health_check_js_1 = require("./health-check.js");
Object.defineProperty(exports, "runFusionHealthCheck", { enumerable: true, get: function () { return health_check_js_1.runFusionHealthCheck; } });
var degradation_test_js_1 = require("./degradation-test.js");
Object.defineProperty(exports, "verifyDegradation", { enumerable: true, get: function () { return degradation_test_js_1.verifyDegradation; } });
var patch_tenant_quota_js_1 = require("./patch-tenant-quota.js");
Object.defineProperty(exports, "DEFAULT_QUOTAS", { enumerable: true, get: function () { return patch_tenant_quota_js_1.DEFAULT_QUOTAS; } });
Object.defineProperty(exports, "setTenantQuota", { enumerable: true, get: function () { return patch_tenant_quota_js_1.setTenantQuota; } });
Object.defineProperty(exports, "getTenantQuota", { enumerable: true, get: function () { return patch_tenant_quota_js_1.getTenantQuota; } });
Object.defineProperty(exports, "reportUsage", { enumerable: true, get: function () { return patch_tenant_quota_js_1.reportUsage; } });
Object.defineProperty(exports, "getCurrentUsage", { enumerable: true, get: function () { return patch_tenant_quota_js_1.getCurrentUsage; } });
Object.defineProperty(exports, "checkQuota", { enumerable: true, get: function () { return patch_tenant_quota_js_1.checkQuota; } });
Object.defineProperty(exports, "resetAllQuotas", { enumerable: true, get: function () { return patch_tenant_quota_js_1.resetAllQuotas; } });
//# sourceMappingURL=index.js.map