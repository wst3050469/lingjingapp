import type { IToolRegistry } from '../adapters/types.js';
import type { FusionConfig } from '../types.js';
import type { IVectorMemoryStore } from '../vector-memory/types.js';
import type { MultiAgentExecutor } from '../multi-agent/multi-agent-executor.js';
import type { DAGOrchestrator } from '../dag-orchestrator/dag-orchestrator.js';
import type { OpenSpaceExecuteTool } from '../openspace/tools/openspace-execute.js';
export interface FusionToolDeps {
    vectorStore?: IVectorMemoryStore;
    multiAgentExecutor?: MultiAgentExecutor;
    dagOrchestrator?: DAGOrchestrator;
    openspaceTool?: OpenSpaceExecuteTool;
}
export declare function registerFusionTools(toolRegistry: IToolRegistry, fusionConfig: FusionConfig, deps: FusionToolDeps): string[];
