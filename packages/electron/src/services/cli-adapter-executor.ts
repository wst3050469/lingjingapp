import { createLogger } from '../monitoring/logger';
import { spawn } from 'child_process';
import type { CliExecuteOptions, CliExecuteResult } from '@codepilot/core/hw-skill/types';

const logger = createLogger('cli-adapter-executor');

const DEFAULT_TIMEOUT = 30000;
const DRC_TIMEOUT = 60000;

export class CliAdapterExecutor {
  async executeCommand(cliPath: string, args: string[], options: CliExecuteOptions = {}): Promise<CliExecuteResult> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const startAt = Date.now();

    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proc: any = (spawn as any)(cliPath, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        const duration = Date.now() - startAt;
        logger.warn('CLI command timed out', { cliPath, args: args.slice(0, 3), timeout });
        resolve({ success: false, exitCode: null, stdout, stderr: stderr + '\nTimeout', duration, error: 'TIMEOUT' });
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startAt;
        const success = code === 0;
        if (!success) {
          logger.warn('CLI command failed', { cliPath, exitCode: code, stderr: stderr.slice(0, 200) });
        }
        resolve({ success, exitCode: code, stdout, stderr, duration });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        const duration = Date.now() - startAt;
        logger.error('CLI spawn error', err, { cliPath });
        resolve({ success: false, exitCode: null, stdout: '', stderr: err.message, duration, error: err.message });
      });
    });
  }

  validateParams(params: Record<string, unknown>, schema: Record<string, unknown>): boolean {
    const required = schema.required as string[] ?? [];
    const properties = schema.properties as Record<string, unknown> ?? {};
    for (const key of required) {
      if (params[key] === undefined || params[key] === null) return false;
    }
    for (const [key, value] of Object.entries(params)) {
      if (properties[key]) {
        const propType = (properties[key] as any).type;
        if (propType === 'string' && typeof value !== 'string') return false;
        if (propType === 'number' && typeof value !== 'number') return false;
        if (propType === 'boolean' && typeof value !== 'boolean') return false;
      }
    }
    return true;
  }

  parseOutput(stdout: string, stderr: string, exitCode: number | null): { success: boolean; data: any; errors: string[] } {
    if (exitCode !== 0) {
      return { success: false, data: null, errors: [stderr || `Exit code: ${exitCode}`] };
    }
    try {
      const parsed = JSON.parse(stdout);
      return { success: true, data: parsed, errors: [] };
    } catch {
      return { success: true, data: stdout, errors: stderr ? [stderr] : [] };
    }
  }

  isCommandAllowed(command: string, allowedCommands: string[]): boolean {
    return allowedCommands.some((allowed) => command.startsWith(allowed));
  }

  getTimeoutForTool(toolName: string): number {
    if (toolName.includes('drc')) return DRC_TIMEOUT;
    return DEFAULT_TIMEOUT;
  }
}

export const cliAdapterExecutor = new CliAdapterExecutor();