import type { IToolRegistry, Tool } from '../adapters/types.js';
import type { FusionConfig, FusionModuleConfig } from '../types.js';
import type { IVectorMemoryStore } from '../vector-memory/types.js';
import type { MultiAgentExecutor } from '../multi-agent/multi-agent-executor.js';
import type { DAGOrchestrator } from '../dag-orchestrator/dag-orchestrator.js';
import type { OpenSpaceExecuteTool } from '../openspace/tools/openspace-execute.js';
import { createRememberVectorTool } from '../vector-memory/tools/remember-vector.js';
import { createRecallVectorTool } from '../vector-memory/tools/recall-vector.js';
import { createParallelExecuteTool } from '../multi-agent/tools/parallel-execute.js';
import { createDagExecuteTool } from '../dag-orchestrator/tools/dag-execute.js';
import { logger } from '../../utils/logger.js';

export interface FusionToolDeps {
  vectorStore?: IVectorMemoryStore;
  multiAgentExecutor?: MultiAgentExecutor;
  dagOrchestrator?: DAGOrchestrator;
  openspaceTool?: OpenSpaceExecuteTool;
}

interface ModuleToggle {
  vectorMemory: boolean;
  openspace: boolean;
  multiAgent: boolean;
  dagOrchestrator: boolean;
}

function resolveModuleToggles(modules: FusionModuleConfig[]): ModuleToggle {
  const isModuleEnabled = (name: string): boolean =>
    modules.some((m) => m.name === name && m.enabled);

  return {
    vectorMemory: isModuleEnabled('vector_memory'),
    openspace: isModuleEnabled('openspace') || isModuleEnabled('skill_security'),
    multiAgent: isModuleEnabled('parallel_executor'),
    dagOrchestrator: isModuleEnabled('dag_engine'),
  };
}

export function registerFusionTools(
  toolRegistry: IToolRegistry,
  fusionConfig: FusionConfig,
  deps: FusionToolDeps,
): string[] {
  const registered: string[] = [];

  if (!fusionConfig.enabled) {
    logger.info('[Fusion:Tools] Fusion disabled, skipping tool registration');
    return registered;
  }

  const toggles = resolveModuleToggles(fusionConfig.modules);

  if (toggles.vectorMemory && deps.vectorStore) {
    const rememberTool = createRememberVectorTool(deps.vectorStore);
    const recallTool = createRecallVectorTool(deps.vectorStore);
    toolRegistry.register(rememberTool);
    toolRegistry.register(recallTool);
    registered.push('remember_vector', 'recall_vector');
    logger.info('[Fusion:Tools] Registered vector memory tools');
  } else if (toggles.vectorMemory) {
    logger.warn('[Fusion:Tools] vectorMemory enabled but no vectorStore provided');
  }

  if (toggles.openspace && deps.openspaceTool) {
    toolRegistry.register(deps.openspaceTool as unknown as Tool);
    registered.push('openspace_execute');
    logger.info('[Fusion:Tools] Registered openspace_execute tool');
  }

  if (toggles.multiAgent && deps.multiAgentExecutor) {
    const parallelTool = createParallelExecuteTool(deps.multiAgentExecutor);
    toolRegistry.register(parallelTool);
    registered.push('parallel_execute');
    logger.info('[Fusion:Tools] Registered parallel_execute tool');
  } else if (toggles.multiAgent) {
    logger.warn('[Fusion:Tools] multiAgent enabled but no executor provided');
  }

  if (toggles.dagOrchestrator && deps.dagOrchestrator) {
    const dagTool = createDagExecuteTool(deps.dagOrchestrator);
    toolRegistry.register(dagTool);
    registered.push('dag_execute');
    logger.info('[Fusion:Tools] Registered dag_execute tool');
  } else if (toggles.dagOrchestrator) {
    logger.warn('[Fusion:Tools] dagOrchestrator enabled but no orchestrator provided');
  }

  logger.info(`[Fusion:Tools] Registered ${registered.length} fusion tools: [${registered.join(', ')}]`);
  return registered;
}
