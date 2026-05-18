import type { Tool, ToolResult, ToolContext, JSONSchema, RiskLevel } from '../../adapters/types.js';
import type { ScriptLanguage, SecurityReviewResult } from '../types.js';
import type { OpenSpaceBridge } from '../bridge.js';
import type { OpenSpaceProcessManager } from '../process-manager.js';
import { reviewScript } from '../security-review.js';
import { matchTemplate, fillTemplate } from '../script-templates.js';
import { logger } from '../../../utils/logger.js';

const PARAMETERS: JSONSchema = {
  type: 'object',
  properties: {
    script: {
      type: 'string',
      description: 'Lua/JavaScript/Python script to execute in OpenSpace',
    },
    language: {
      type: 'string',
      enum: ['lua', 'javascript', 'python'],
      description: 'Script language',
    },
    timeout: {
      type: 'number',
      description: 'Execution timeout in milliseconds',
      default: 30000,
    },
    preview: {
      type: 'boolean',
      description: 'Preview mode: only run security review without execution',
      default: false,
    },
    scripts: {
      type: 'array',
      items: { type: 'string' },
      description: 'Batch execution: array of scripts to execute sequentially',
    },
  },
  required: ['script', 'language'],
};

export class OpenSpaceExecuteTool implements Tool {
  readonly name = 'openspace_execute';
  readonly description = 'Execute OpenSpace script commands to control the universe visualization scene';
  readonly parameters = PARAMETERS;
  readonly riskLevel: RiskLevel = 'medium';

  private bridge: OpenSpaceBridge | null = null;
  private processManager: OpenSpaceProcessManager | null = null;

  setBridge(bridge: OpenSpaceBridge): void {
    this.bridge = bridge;
  }

  setProcessManager(manager: OpenSpaceProcessManager): void {
    this.processManager = manager;
  }

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const script = params.script as string;
    const language = params.language as ScriptLanguage;
    const timeout = (params.timeout as number) ?? 30000;
    const preview = (params.preview as boolean) ?? false;
    const scripts = params.scripts as string[] | undefined;

    if (!['lua', 'javascript', 'python'].includes(language)) {
      return {
        content: `Invalid language: "${language}". Supported: lua, javascript, python`,
        isError: true,
      };
    }

    if (!this.processManager || this.processManager.runState !== 'running') {
      return {
        content: 'OpenSpace is not running, please start it first',
        isError: true,
      };
    }

    if (scripts && scripts.length > 0) {
      return this.executeBatch(scripts, language, timeout);
    }

    const securityResult = reviewScript(script, language);

    if (preview) {
      return {
        content: JSON.stringify({
          preview: true,
          securityReview: securityResult,
          script,
          language,
        }),
      };
    }

    if (!securityResult.passed) {
      const violations = securityResult.violations
        .map((v) => `  Line ${v.line}: ${v.description} (${v.riskLevel})`)
        .join('\n');
      return {
        content: `Security review failed (risk: ${securityResult.riskLevel}):\n${violations}`,
        isError: true,
      };
    }

    if (!this.bridge || !this.bridge.isConnected) {
      return {
        content: 'OpenSpace bridge is not connected',
        isError: true,
      };
    }

    try {
      const result = await this.bridge.sendScript({ script, language, timeout });

      if (!result.success) {
        logger.warn(`[OpenSpaceExecuteTool] execution failed: ${result.error}`);
        return {
          content: `Execution failed: ${result.error}`,
          isError: true,
        };
      }

      return {
        content: JSON.stringify({
          success: true,
          result: result.result,
          duration: result.duration,
          language,
        }),
      };
    } catch (err) {
      return {
        content: `Execution error: ${(err as Error).message}`,
        isError: true,
      };
    }
  }

  private async executeBatch(scripts: string[], language: ScriptLanguage, timeout: number): Promise<ToolResult> {
    if (!this.bridge || !this.bridge.isConnected) {
      return {
        content: 'OpenSpace bridge is not connected',
        isError: true,
      };
    }

    const results: Array<{ script: string; success: boolean; result?: unknown; error?: string; duration?: number; securityReview?: SecurityReviewResult }> = [];

    for (const script of scripts) {
      const securityResult = reviewScript(script, language);

      if (!securityResult.passed) {
        results.push({
          script,
          success: false,
          error: `Security review failed (risk: ${securityResult.riskLevel})`,
          securityReview: securityResult,
        });
        continue;
      }

      try {
        const result = await this.bridge.sendScript({ script, language, timeout });
        results.push({
          script,
          success: result.success,
          result: result.result,
          error: result.error,
          duration: result.duration,
        });
      } catch (err) {
        results.push({
          script,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    return {
      content: JSON.stringify({ batch: true, results, language }),
    };
  }
}
