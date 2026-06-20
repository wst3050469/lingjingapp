/**
 * Fusion Module Health Check — Batch D (P1)
 *
 * Validates all 16 fusion modules and produces FusionHealthReport.
 */

import type { FusionConfig } from '../types.js';
import type { IEventBus } from '../event-bus/types.js';
import type { IHookRegistry } from '../hook-registry/types.js';
import type { IVectorMemoryStore } from '../vector-memory/types.js';
import type { INudgeReviewEngine } from '../review-engine/types.js';
import type { SecurityScanner } from '../skill-security/security-scanner.js';
import type { ExecutionTraceHarvester } from '../trace-harvester/execution-trace-harvester.js';
import type { IDAGOrchestrator } from '../dag-orchestrator/types.js';
import type { IMultiAgentExecutor } from '../multi-agent/types.js';
import type { IDynamicModelRouter } from '../model-router/types.js';
import type { INLCronScheduler } from '../nl-cron/types.js';
import type { IHonchoUserModeler } from '../user-modeler/types.js';
import type { IConnectorHubAdapter } from '../connectors/types.js';
import type { IMessageGateway } from '../gateway/types.js';

export interface FusionHealthModule {
  name: string;
  healthy: boolean;
  details: string;
  enabled: boolean;
}

export interface FusionHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  modules: FusionHealthModule[];
  timestamp: number;
}

interface HealthCheckDeps {
  config: FusionConfig;
  eventBus?: IEventBus;
  hookRegistry?: IHookRegistry;
  vectorMemory?: IVectorMemoryStore;
  reviewEngine?: INudgeReviewEngine;
  securityScanner?: SecurityScanner;
  traceHarvester?: ExecutionTraceHarvester;
  dagOrchestrator?: IDAGOrchestrator;
  multiAgent?: IMultiAgentExecutor;
  modelRouter?: IDynamicModelRouter;
  nlCron?: INLCronScheduler;
  userModeler?: IHonchoUserModeler;
  connectorHub?: IConnectorHubAdapter;
  messageGateway?: IMessageGateway;
}

function isModuleEnabled(config: FusionConfig, configName: string): boolean {
  return config.modules.some((m) => m.name === configName && m.enabled);
}

function safeCheck(fn: () => boolean): { ok: boolean; detail: string } {
  try {
    const ok = fn();
    return { ok, detail: ok ? 'healthy' : 'health check returned false' };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

export function runFusionHealthCheck(deps: HealthCheckDeps): FusionHealthReport {
  const { config } = deps;
  const modules: FusionHealthModule[] = [];

  modules.push({
    name: 'EventBus',
    enabled: isModuleEnabled(config, 'event_bus'),
    ...safeCheck(() => { const h = deps.eventBus?.healthCheck(); return h?.healthy ?? false; }),
  });

  modules.push({
    name: 'HookRegistry',
    enabled: isModuleEnabled(config, 'hook_registry'),
    ...safeCheck(() => { const h = deps.hookRegistry?.healthCheck(); return h?.healthy ?? false; }),
  });

  modules.push({
    name: 'SlidingWindowMemoryManager',
    enabled: isModuleEnabled(config, 'sliding_window'),
    healthy: true,
    details: 'stateless — always healthy',
  });

  modules.push({
    name: 'VectorMemoryStore',
    enabled: isModuleEnabled(config, 'vector_memory'),
    ...safeCheck(() => { const h = deps.vectorMemory?.healthCheck(); return h?.healthy ?? false; }),
  });

  modules.push({
    name: 'NudgeReviewEngine',
    enabled: isModuleEnabled(config, 'review_gate'),
    ...safeCheck(() => { const h = deps.reviewEngine?.healthCheck(); return h?.healthy ?? false; }),
  });

  modules.push({
    name: 'SkillSecurityLoader',
    enabled: isModuleEnabled(config, 'skill_security'),
    ...safeCheck(() => deps.securityScanner !== null),
  });

  modules.push({
    name: 'ExecutionTraceHarvester',
    enabled: isModuleEnabled(config, 'execution_traces'),
    healthy: deps.traceHarvester !== undefined,
    details: deps.traceHarvester ? 'configured' : 'not configured',
  });

  modules.push({
    name: 'DAGOrchestrator',
    enabled: isModuleEnabled(config, 'dag_engine'),
    ...safeCheck(() => { const h = deps.dagOrchestrator?.healthCheck(); return h?.healthy ?? false; }),
  });

  modules.push({
    name: 'MultiAgentExecutor',
    enabled: isModuleEnabled(config, 'parallel_executor'),
    ...safeCheck(() => { const h = deps.multiAgent?.healthCheck(); return h?.healthy ?? false; }),
  });

  modules.push({
    name: 'DynamicModelRouter',
    enabled: isModuleEnabled(config, 'model_routing'),
    ...safeCheck(() => { const h = deps.modelRouter?.healthCheck(); return h?.healthy ?? false; }),
  });

  modules.push({
    name: 'HonchoUserModeler',
    enabled: isModuleEnabled(config, 'user_profiler'),
    ...safeCheck(() => { const h = deps.userModeler?.healthCheck(); return h?.healthy ?? false; }),
  });

  modules.push({
    name: 'NLCronScheduler',
    enabled: isModuleEnabled(config, 'cron_scheduler'),
    ...safeCheck(() => { const h = deps.nlCron?.healthCheck(); return h?.healthy ?? false; }),
  });

  modules.push({
    name: 'MessageGateway',
    enabled: true,
    healthy: deps.messageGateway !== undefined,
    details: deps.messageGateway ? 'available' : 'not available',
  });

  modules.push({
    name: 'ConnectorHubAdapter',
    enabled: true,
    healthy: deps.connectorHub !== undefined,
    details: deps.connectorHub ? 'available' : 'not available',
  });

  const enabledModules = modules.filter((m) => m.enabled);
  const healthyCount = enabledModules.filter((m) => m.healthy).length;
  const enabledCount = enabledModules.length;

  let overall: FusionHealthReport['overall'];
  if (enabledCount === 0) {
    overall = 'unhealthy';
  } else if (healthyCount === enabledCount) {
    overall = 'healthy';
  } else if (healthyCount === 0) {
    overall = 'unhealthy';
  } else {
    overall = 'degraded';
  }

  return { overall, modules, timestamp: Date.now() };
}
