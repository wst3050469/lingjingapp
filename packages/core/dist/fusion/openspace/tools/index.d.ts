import type { Tool } from '../../adapters/types.js';
import type { OpenSpaceBridge } from '../bridge.js';
import type { OpenSpaceProcessManager } from '../process-manager.js';
/**
 * Create the openspace_execute tool — sends a script to the connected OpenSpace instance.
 */
export declare function createOpenSpaceExecuteTool(bridge: OpenSpaceBridge): Tool;
/**
 * Create the openspace_query tool — queries OpenSpace scene context or process health.
 */
export declare function createOpenSpaceQueryTool(bridge: OpenSpaceBridge, processManager: OpenSpaceProcessManager): Tool;
export interface OpenSpaceToolSet {
    openspace_execute: Tool;
    openspace_query: Tool;
}
/**
 * Create the full OpenSpace tool set.
 */
export declare function createOpenSpaceToolSet(bridge: OpenSpaceBridge, processManager: OpenSpaceProcessManager): OpenSpaceToolSet;
//# sourceMappingURL=index.d.ts.map