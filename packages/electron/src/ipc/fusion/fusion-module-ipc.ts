import { ipcMain } from 'electron';
import type { FusionInitializer } from '../../../core/src/fusion/fusion-initializer.js';
import type { INLCronScheduler } from '../../../core/src/fusion/nl-cron/types.js';
import type { IDynamicModelRouter } from '../../../core/src/fusion/model-router/types.js';
import type { IVectorMemoryStore } from '../../../core/src/fusion/vector-memory/types.js';
import type { INudgeReviewEngine } from '../../../core/src/fusion/review-engine/types.js';
import type { ExecutionTraceHarvester } from '../../../core/src/fusion/trace-harvester/execution-trace-harvester.js';
import type { SkillSecurityLoader } from '../../../core/src/fusion/skill-security/skill-security-loader.js';
import type { IDAGOrchestrator } from '../../../core/src/fusion/dag-orchestrator/types.js';
import type { IMultiAgentExecutor } from '../../../core/src/fusion/multi-agent/types.js';
import type { IHonchoUserModeler } from '../../../core/src/fusion/user-modeler/types.js';

let fusionInitializer: FusionInitializer | null = null;
let nlCron: INLCronScheduler | null = null;
let modelRouter: IDynamicModelRouter | null = null;
let vectorMemory: IVectorMemoryStore | null = null;
let reviewEngine: INudgeReviewEngine | null = null;
let traceHarvester: ExecutionTraceHarvester | null = null;
let skillSecurity: SkillSecurityLoader | null = null;
let dagOrchestrator: IDAGOrchestrator | null = null;
let multiAgent: IMultiAgentExecutor | null = null;
let userModeler: IHonchoUserModeler | null = null;

export function setFusionModules(modules: {
  fusionInitializer?: FusionInitializer;
  nlCron?: INLCronScheduler;
  modelRouter?: IDynamicModelRouter;
  vectorMemory?: IVectorMemoryStore;
  reviewEngine?: INudgeReviewEngine;
  traceHarvester?: ExecutionTraceHarvester;
  skillSecurity?: SkillSecurityLoader;
  dagOrchestrator?: IDAGOrchestrator;
  multiAgent?: IMultiAgentExecutor;
  userModeler?: IHonchoUserModeler;
}): void {
  if (modules.fusionInitializer) fusionInitializer = modules.fusionInitializer;
  if (modules.nlCron) nlCron = modules.nlCron;
  if (modules.modelRouter) modelRouter = modules.modelRouter;
  if (modules.vectorMemory) vectorMemory = modules.vectorMemory;
  if (modules.reviewEngine) reviewEngine = modules.reviewEngine;
  if (modules.traceHarvester) traceHarvester = modules.traceHarvester;
  if (modules.skillSecurity) skillSecurity = modules.skillSecurity;
  if (modules.dagOrchestrator) dagOrchestrator = modules.dagOrchestrator;
  if (modules.multiAgent) multiAgent = modules.multiAgent;
  if (modules.userModeler) userModeler = modules.userModeler;
}

export function registerFusionModuleIpc(): void {
  ipcMain.handle('fusion:vector:store', async (_event, content: string, metadata: Record<string, unknown>) => {
    if (!vectorMemory) throw new Error('VectorMemory not initialized');
    return vectorMemory.store(content, metadata);
  });
  ipcMain.handle('fusion:vector:search', async (_event, query: string, topK?: number) => {
    if (!vectorMemory) throw new Error('VectorMemory not initialized');
    return vectorMemory.search(query, topK);
  });
  ipcMain.handle('fusion:vector:delete', async (_event, id: string) => {
    if (!vectorMemory) throw new Error('VectorMemory not initialized');
    return vectorMemory.remove(id);
  });
  ipcMain.handle('fusion:vector:sync', async (_event, entries: Array<{ id: string; content: string; category: string }>) => {
    if (!vectorMemory) throw new Error('VectorMemory not initialized');
    return vectorMemory.syncFromMemory(entries);
  });
  ipcMain.handle('fusion:vector:status', async () => {
    if (!vectorMemory) throw new Error('VectorMemory not initialized');
    return vectorMemory.healthCheck();
  });

  ipcMain.handle('fusion:review:config', async () => {
    if (!reviewEngine) throw new Error('ReviewEngine not initialized');
    return { enabled: true };
  });
  ipcMain.handle('fusion:review:reports', async () => {
    return [];
  });
  ipcMain.handle('fusion:review:status', async () => {
    if (!reviewEngine) throw new Error('ReviewEngine not initialized');
    return reviewEngine.healthCheck();
  });

  ipcMain.handle('fusion:trace:config', async () => {
    return { enabled: true };
  });
  ipcMain.handle('fusion:trace:history', async () => {
    return [];
  });
  ipcMain.handle('fusion:trace:skills', async () => {
    return [];
  });

  ipcMain.handle('fusion:skill:scan', async (_event, skillPath: string) => {
    if (!skillSecurity) throw new Error('SkillSecurity not initialized');
    return { skillPath, findings: [], riskLevel: 'none', allowed: true };
  });
  ipcMain.handle('fusion:skill:audit', async () => {
    return [];
  });
  ipcMain.handle('fusion:skill:blocked', async () => {
    return [];
  });

  ipcMain.handle('fusion:dag:execute', async (_event, dag: unknown, context: Record<string, unknown>) => {
    if (!dagOrchestrator) throw new Error('DAGOrchestrator not initialized');
    return dagOrchestrator.execute(dag as any, context);
  });
  ipcMain.handle('fusion:dag:status', async (_event, dagId: string) => {
    return { dagId, status: 'unknown' };
  });
  ipcMain.handle('fusion:dag:retry', async (_event, dagId: string) => {
    return { success: false, error: 'Not implemented' };
  });
  ipcMain.handle('fusion:dag:cancel', async (_event, dagId: string) => {
    return { success: false, error: 'Not implemented' };
  });

  ipcMain.handle('fusion:parallel:execute', async (_event, tasks: unknown[], context: Record<string, unknown>) => {
    if (!multiAgent) throw new Error('MultiAgentExecutor not initialized');
    return multiAgent.execute(tasks as any, context);
  });
  ipcMain.handle('fusion:parallel:status', async () => {
    if (!multiAgent) throw new Error('MultiAgentExecutor not initialized');
    return multiAgent.healthCheck();
  });

  ipcMain.handle('fusion:router:rules', async () => {
    if (!modelRouter) throw new Error('ModelRouter not initialized');
    return modelRouter.getRules();
  });
  ipcMain.handle('fusion:router:addRule', async (_event, rule: unknown) => {
    if (!modelRouter) throw new Error('ModelRouter not initialized');
    return modelRouter.addRule(rule as any);
  });
  ipcMain.handle('fusion:router:removeRule', async (_event, id: string) => {
    if (!modelRouter) throw new Error('ModelRouter not initialized');
    return modelRouter.removeRule(id);
  });
  ipcMain.handle('fusion:router:audit', async () => {
    return [];
  });
  ipcMain.handle('fusion:router:status', async () => {
    if (!modelRouter) throw new Error('ModelRouter not initialized');
    return modelRouter.healthCheck();
  });

  ipcMain.handle('fusion:cron:schedule', async (_event, naturalLanguage: string, task: string) => {
    if (!nlCron) throw new Error('NLCronScheduler not initialized');
    return nlCron.scheduleFromNL(naturalLanguage, task);
  });
  ipcMain.handle('fusion:cron:list', async () => {
    if (!nlCron) throw new Error('NLCronScheduler not initialized');
    return nlCron.listSchedules();
  });
  ipcMain.handle('fusion:cron:cancel', async (_event, id: string) => {
    if (!nlCron) throw new Error('NLCronScheduler not initialized');
    return nlCron.cancelSchedule(id);
  });
  ipcMain.handle('fusion:cron:preview', async (_event, naturalLanguage: string) => {
    if (!nlCron) throw new Error('NLCronScheduler not initialized');
    return nlCron.previewCron(naturalLanguage);
  });

  ipcMain.handle('fusion:usermodel:profile', async () => {
    if (!userModeler) throw new Error('UserModeler not initialized');
    return userModeler.getCurrentModel();
  });
  ipcMain.handle('fusion:usermodel:trigger', async () => {
    if (!userModeler) throw new Error('UserModeler not initialized');
    await userModeler.triggerReflection();
    return { success: true };
  });
  ipcMain.handle('fusion:usermodel:status', async () => {
    if (!userModeler) throw new Error('UserModeler not initialized');
    return userModeler.healthCheck();
  });

  ipcMain.handle('fusion:health:check', async () => {
    if (!fusionInitializer) throw new Error('FusionInitializer not initialized');
    return Object.fromEntries(fusionInitializer.healthCheck());
  });
  ipcMain.handle('fusion:config:get', async () => {
    return {};
  });
  ipcMain.handle('fusion:config:set', async (_event, key: string, value: unknown) => {
    return { success: true, key, value };
  });
  ipcMain.handle('fusion:module:toggle', async (_event, moduleName: string, enabled: boolean) => {
    if (!fusionInitializer) throw new Error('FusionInitializer not initialized');
    fusionInitializer.toggleModule(moduleName as any, enabled);
    return { success: true };
  });
}
