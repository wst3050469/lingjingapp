import type { Tool } from '../../adapters/types.js';
import type { MultiAgentExecutor } from '../multi-agent-executor.js';
export declare function createParallelExecuteTool(executor: MultiAgentExecutor): Tool;
