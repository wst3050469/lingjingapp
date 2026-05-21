import type { Tool, ToolResult, ToolContext, JSONSchema, RiskLevel } from '../../adapters/types.js';
import type { OpenSpaceBridge } from '../bridge.js';
import type { OpenSpaceProcessManager } from '../process-manager.js';
export declare class OpenSpaceExecuteTool implements Tool {
    readonly name = "openspace_execute";
    readonly description = "Execute OpenSpace script commands to control the universe visualization scene";
    readonly parameters: JSONSchema;
    readonly riskLevel: RiskLevel;
    private bridge;
    private processManager;
    setBridge(bridge: OpenSpaceBridge): void;
    setProcessManager(manager: OpenSpaceProcessManager): void;
    execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
    private executeBatch;
}
//# sourceMappingURL=openspace-execute.d.ts.map