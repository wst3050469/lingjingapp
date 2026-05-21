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
