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

export { patchElectronMain } from './patch-electron-main.js';
export type { PatchElectronMainResult } from './patch-electron-main.js';

export { getMigration003SQL } from './patch-database.js';

export { patchAgentHooks } from './patch-agent.js';
export type {
  AgentContext,
  LLMResponseContext,
  ToolExecutionContext,
  ToolResultContext,
  SkillContext,
  MemoryWriteContext,
  CompactionContext,
  AgentHookPointers,
} from './patch-agent.js';

export { registerFusionTools } from './patch-tools.js';
export type { FusionToolDeps } from './patch-tools.js';

export { registerFusionSkills } from './patch-skills.js';
export type { FusionSkillPaths } from './patch-skills.js';

export { setupMemoryLinkages } from './patch-memory.js';
export type { MemoryLinkageDeps, MemoryLinkageResult } from './patch-memory.js';

/**
 * Batch C (P1 Renderer UI路由注册 + scifi-dark主题切换):
 * - patch-renderer.tsx     → Fusion 侧栏面板注册 + 懒加载组件映射
 * - patch-theme-switch.tsx → scifi-dark 主题选项 + CSS变量 + 主题选择菜单
 */

/**
 * Batch D (P1 Cloud Server RBAC + Audit Log + Health Check + Degradation Test + Tenant Quota):
 * - patch-cloud-rbac.ts    → RBAC roles, permissions, JWT middleware
 * - patch-audit-log.ts     → Audit log entry, query, API middleware
 * - health-check.ts        → Fusion module health check → FusionHealthReport
 * - degradation-test.ts    → Degradation verification → DegradationReport
 * - patch-tenant-quota.ts  → Tenant resource quotas + check
 */

export {
  RBAC_ROLES,
  RBAC_PERMISSIONS,
  checkPermission,
  extractRoleFromToken,
  createRBACMiddleware,
} from './patch-cloud-rbac.js';
export type {
  RBACRole,
  RBACAction,
  RBACResource,
  RBACRoleDefinition,
  JWTTokenPayload,
} from './patch-cloud-rbac.js';

export {
  createAuditLog,
  queryAuditLogs,
  clearAuditLogs,
  getAuditLogCount,
  createAuditMiddleware,
} from './patch-audit-log.js';
export type {
  AuditLogEntry,
  AuditLogFilter,
} from './patch-audit-log.js';

export {
  runFusionHealthCheck,
} from './health-check.js';
export type {
  FusionHealthModule,
  FusionHealthReport as IntegrationFusionHealthReport,
} from './health-check.js';

export {
  verifyDegradation,
} from './degradation-test.js';
export type {
  DegradationCheck,
  DegradationReport,
} from './degradation-test.js';

export {
  DEFAULT_QUOTAS,
  setTenantQuota,
  getTenantQuota,
  reportUsage,
  getCurrentUsage,
  checkQuota,
  resetAllQuotas,
} from './patch-tenant-quota.js';
export type {
  TenantTier,
  TenantQuota,
  QuotaResource,
} from './patch-tenant-quota.js';
