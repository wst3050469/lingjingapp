import type { Tool, ToolResult, ToolContext, JSONSchema } from '../../adapters/types.js';
import type { OpenSpaceBridge } from '../bridge.js';
import type { OpenSpaceProcessManager } from '../process-manager.js';
import type { ScriptLanguage, ScriptResult, SceneContext } from '../types.js';
import { logger } from '../../../utils/logger.js';

const executeParams: JSONSchema = {
  type: 'object',
  properties: {
    script: { type: 'string', description: 'Lua/JavaScript/Python script to execute in OpenSpace' },
    language: {
      type: 'string',
      enum: ['lua', 'javascript', 'python'],
      description: 'Script language',
      default: 'lua',
    },
    timeout: { type: 'number', description: 'Command timeout in milliseconds', default: 30000 },
  },
  required: ['script'],
};

const querySceneParams: JSONSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['scene', 'health'],
      description: 'Query type',
      default: 'scene',
    },
  },
};

/**
 * Create the openspace_execute tool — sends a script to the connected OpenSpace instance.
 */
export function createOpenSpaceExecuteTool(bridge: OpenSpaceBridge): Tool {
  return {
    name: 'openspace_execute',
    description: 'Execute a Lua/JavaScript/Python script in a running OpenSpace instance',
    parameters: executeParams,
    async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
      try {
        if (!bridge.isConnected) {
          return { content: 'OpenSpace is not connected. Ensure OpenSpace is running.', isError: true };
        }

        const script = params.script as string;
        const language = (params.language as ScriptLanguage) ?? 'lua';
        const timeout = (params.timeout as number) ?? 30000;

        logger.info(`[OpenSpaceTool] executing ${language} script (${script.length} chars)`);

        const result: ScriptResult = await bridge.sendScript({ script, language, timeout });

        if (result.success) {
          return {
            content: JSON.stringify(result.result ?? { status: 'executed' }),
          };
        }
        return {
          content: `Script execution failed: ${result.error ?? 'unknown error'}`,
          isError: true,
        };
      } catch (err) {
        return { content: `OpenSpace execute error: ${(err as Error).message}`, isError: true };
      }
    },
  };
}

/**
 * Create the openspace_query tool — queries OpenSpace scene context or process health.
 */
export function createOpenSpaceQueryTool(
  bridge: OpenSpaceBridge,
  processManager: OpenSpaceProcessManager,
): Tool {
  return {
    name: 'openspace_query',
    description: 'Query OpenSpace scene context, process health status, or installation detection',
    parameters: querySceneParams,
    async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
      try {
        const action = (params.action as string) ?? 'scene';

        if (action === 'health') {
          const health = processManager.health;
          const installation = processManager.installation;
          return {
            content: JSON.stringify({
              state: processManager.runState,
              installed: installation.found,
              installationPath: installation.path,
              version: installation.version,
              compatible: installation.compatible,
              healthy: health?.healthy ?? false,
              wsPort: processManager.getWebSocketPort(),
            }, null, 2),
          };
        }

        // Default: scene context
        if (!bridge.isConnected) {
          return { content: 'OpenSpace is not connected.', isError: true };
        }

        const scene: SceneContext = await bridge.getSceneContext();
        return {
          content: JSON.stringify(scene, null, 2),
        };
      } catch (err) {
        return { content: `OpenSpace query error: ${(err as Error).message}`, isError: true };
      }
    },
  };
}

export interface OpenSpaceToolSet {
  openspace_execute: Tool;
  openspace_query: Tool;
}

/**
 * Create the full OpenSpace tool set.
 */
export function createOpenSpaceToolSet(
  bridge: OpenSpaceBridge,
  processManager: OpenSpaceProcessManager,
): OpenSpaceToolSet {
  return {
    openspace_execute: createOpenSpaceExecuteTool(bridge),
    openspace_query: createOpenSpaceQueryTool(bridge, processManager),
  };
}
