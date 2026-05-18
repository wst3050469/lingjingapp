export { EventBus } from './event-bus/event-bus.js';
export { MetricsCollector } from './event-bus/metrics.js';
export type {
  EventTopic,
  EventMessage,
  EventHandler,
  SubscribeOptions,
  EventFilter,
  UnsubscribeFn,
  EventBusMetrics,
  IEventBus,
} from './event-bus/types.js';

export { HookRegistry } from './hook-registry/hook-registry.js';
export type {
  HookPoint,
  HookContext,
  HookCallback,
  HookOptions,
  HookEntry,
  IHookRegistry,
} from './hook-registry/types.js';

export { LLMAdapter, createLLMAdapter } from './adapters/llm-adapter.js';
export { MemoryAdapter, createMemoryAdapter } from './adapters/memory-adapter.js';
export { SkillAdapter, createSkillAdapter } from './adapters/skill-adapter.js';
export { ToolAdapter, createToolAdapter } from './adapters/tool-adapter.js';
export { SchedulerAdapter, createSchedulerAdapter } from './adapters/scheduler-adapter.js';
export type {
  ILLMAdapter,
  IMemoryAdapter,
  ISkillAdapter,
  IToolAdapter,
  ISchedulerAdapter,
  LLMProvider,
  ChatRequest,
  StreamEvent,
  Message,
  ToolSchema,
  Tool,
  ToolResult,
  ToolContext,
  JSONSchema,
  RiskLevel,
  ToolLifecycle,
  IToolRegistry,
  SkillConfig,
  SchedulerTask,
} from './adapters/types.js';

export { CircuitBreaker, CircuitState } from './circuit-breaker.js';
export type { CircuitBreakerConfig } from './circuit-breaker.js';

export { SlidingWindowMemoryManager } from './sliding-window/sliding-window-manager.js';
export type { SlidingWindowConfig, CompactResult, ISlidingWindowMemoryManager } from './sliding-window/types.js';
export { DEFAULT_SLIDING_WINDOW_CONFIG } from './sliding-window/types.js';

export { VectorMemoryStore } from './vector-memory/vector-memory-store.js';
export { InMemoryVectorAdapter } from './vector-memory/adapters/in-memory-adapter.js';
export { createRememberVectorTool } from './vector-memory/tools/remember-vector.js';
export { createRecallVectorTool } from './vector-memory/tools/recall-vector.js';
export type { VectorMemoryConfig, VectorSearchResult, IVectorStoreAdapter, IVectorMemoryStore } from './vector-memory/types.js';
export { DEFAULT_VECTOR_MEMORY_CONFIG } from './vector-memory/types.js';

export { NudgeReviewEngine } from './review-engine/nudge-review-engine.js';
export { LLMQuotaManager } from './review-engine/llm-quota-manager.js';
export type { ReviewConfig, ReviewReport, INudgeReviewEngine } from './review-engine/types.js';
export { DEFAULT_REVIEW_CONFIG } from './review-engine/types.js';

export { SecurityScanner } from './skill-security/security-scanner.js';
export { ProgressiveLoader } from './skill-security/progressive-loader.js';
export { SkillSecurityLoader } from './skill-security/skill-security-loader.js';
export type { SecurityConfig, SecurityRisk, SecurityFinding, SecurityScanResult, SkillMeta } from './skill-security/types.js';
export { DEFAULT_SECURITY_CONFIG } from './skill-security/types.js';

export { ExecutionTraceHarvester } from './trace-harvester/execution-trace-harvester.js';
export type { TraceHarvesterConfig, ToolCallStep, ExecutionTrace, WorkflowPattern } from './trace-harvester/types.js';
export { DEFAULT_TRACE_HARVESTER_CONFIG } from './trace-harvester/types.js';

export type {
  FusionConfig,
  FusionModuleConfig,
  FusionHealthReport,
  FusionModule,
} from './types.js';
export { FUSION_MODULES, DEFAULT_FUSION_CONFIG } from './types.js';

export { DAGOrchestrator } from './dag-orchestrator/dag-orchestrator.js';
export type {
  RetryPolicy,
  BranchCondition,
  TaskDefinition,
  DAGNode,
  DAGEdge,
  DAGDefinition,
  TaskResult as DAGTaskResult,
  DAGResult,
  ExecutionLayer,
  ExecuteNodeCallback,
  IDAGOrchestrator,
} from './dag-orchestrator/types.js';

export { MultiAgentExecutor } from './multi-agent/multi-agent-executor.js';
export type {
  MultiAgentConfig,
  ParallelTask,
  TaskExecutionResult,
  ParallelResult,
  ExecuteSingleTaskCallback,
  IMultiAgentExecutor,
} from './multi-agent/types.js';
export { DEFAULT_MULTI_AGENT_CONFIG } from './multi-agent/types.js';

export { DynamicModelRouter } from './model-router/dynamic-model-router.js';
export type {
  ModelRouterConfig,
  RouteRule,
  TaskFeatures,
  RoutingDecision,
  IDynamicModelRouter,
} from './model-router/types.js';
export { DEFAULT_MODEL_ROUTER_CONFIG } from './model-router/types.js';

export { HonchoUserModeler } from './user-modeler/honcho-user-modeler.js';
export type {
  UserProfile,
  UserModelerConfig,
  ReflectCallback,
  IHonchoUserModeler,
} from './user-modeler/types.js';
export { DEFAULT_USER_MODELER_CONFIG, createDefaultProfile } from './user-modeler/types.js';

export { NLCronScheduler } from './nl-cron/nl-cron-scheduler.js';
export { NLToCronConverter } from './nl-cron/nl-to-cron-converter.js';
export type { NLCronConfig, CronSchedule, ScheduleResult, INLCronScheduler } from './nl-cron/types.js';
export { DEFAULT_NL_CRON_CONFIG } from './nl-cron/types.js';

export { ConnectorHubAdapter } from './connectors/connector-hub-adapter.js';
export type { ConnectorConfig, IConnector, IConnectorHubAdapter } from './connectors/types.js';

export { MessageGateway } from './gateway/message-gateway.js';
export type { UnifiedMessage, IPlatformConnector, IMessageGateway } from './gateway/types.js';

export { FusionInitializer } from './fusion-initializer.js';
export type { FusionInitResult } from './fusion-initializer.js';
 
export * as openspace from './openspace/index.js';
