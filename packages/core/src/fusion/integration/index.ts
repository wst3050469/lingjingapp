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

export { getMigration003SQL, getMigration004SQL } from './patch-database.js';

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
 * Batch C (P1 Renderer UI路由注册 + scifi-dark主题切换 + OpenSpace集成完善):
 * - patch-renderer.tsx     → Fusion/OpenSpace 侧栏面板注册 + 懒加载组件映射
 * - patch-theme-switch.tsx → scifi-dark 主题选项 + CSS变量 + 主题选择菜单
 * - patch-openspace.ts     → OpenSpace 路径检测 + WebSocket/窗口嵌入说明 + Lua脚本
 */

export {
  FUSION_SIDEBAR_PANELS,
  OPENSPACE_SIDEBAR_PANELS,
  FUSION_PANEL_COMPONENTS,
  OPENSPACE_PANEL_COMPONENTS,
  ALL_SIDEBAR_PANELS,
  ALL_PANEL_COMPONENTS,
  getPanelIconEntries,
} from './patch-renderer.js';
export type {
  SidebarPanelDef,
  FusionSidebarPanel,
  OpenSpaceSidebarPanel,
} from './patch-renderer.js';

export {
  SCIFI_THEME_OPTION,
  SCIFI_DARK_CSS_VARS,
  THEME_OPTIONS,
} from './patch-theme-switch.js';
export type {
  ScifiThemeId,
  ExtendedThemeMode,
} from './patch-theme-switch.js';

export {
  detectOpenSpace,
  detectOpenSpaceWindows,
  detectOpenSpaceLinux,
  patchOpenSpaceIntegration,
  LUA_FRAME_EXPORT,
  LUA_GLOBE_SYNC,
} from './patch-openspace.js';
export type {
  OpenSpaceDetectionResult,
  OpenSpacePatchResult,
} from './patch-openspace.js';

/**
 * Batch D (P1 Cloud Server RBAC + Audit Log + Health Check + Degradation Test):
 * - patch-cloud-rbac.ts    → RBAC roles, permissions, JWT middleware
 * - patch-audit-log.ts     → Audit log entry, query, API middleware
 * - health-check.ts        → Fusion module health check → FusionHealthReport
 * - degradation-test.ts    → Degradation verification → DegradationReport
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


