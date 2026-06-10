// BUG-018: Execution Trace Writer
// Records tool execution traces to the execution_traces SQLite table
// for debugging, auditing, and performance analysis.

import { getDatabase } from '../db/database';
import { randomUUID } from 'node:crypto';

export interface ExecutionTrace {
  id: string;
  sessionId: string;
  toolName: string;
  parameters: string;
  result: string;
  durationMs: number;
  importance: number;
  createdAt: string;
}

/**
 * Write a tool execution trace to the database.
 * Non-blocking — errors are logged but never thrown to avoid breaking the agent loop.
 */
export function writeExecutionTrace(params: {
  sessionId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  result: string | object;
  durationMs: number;
  importance?: number;
}): void {
  try {
    const db = getDatabase();
    if (!db) return;

    const id = randomUUID();
    const parametersJson = JSON.stringify(params.parameters);
    const resultStr = typeof params.result === 'string' ? params.result : JSON.stringify(params.result);
    const importance = params.importance ?? 0;

    db.run(
      `INSERT OR IGNORE INTO execution_traces (id, session_id, tool_name, parameters, result, duration_ms, importance)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, params.sessionId, params.toolName, parametersJson, resultStr, params.durationMs, importance]
    );
  } catch (err) {
    // Never let tracing failures break the agent loop
    console.error('[ExecutionTrace] Failed to write trace:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Wrap a tool execute function with execution tracing (duration + result recording).
 */
export function traceToolExecution<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  sessionId: string,
  execute: T,
): T {
  return (async (...args: any[]) => {
    const start = Date.now();
    try {
      const result = await execute(...args);
      const durationMs = Date.now() - start;

      // Extract parameters from the first argument (usually params object)
      const params = args[0] && typeof args[0] === 'object' ? args[0] : {};

      writeExecutionTrace({
        sessionId,
        toolName,
        parameters: params,
        result,
        durationMs,
      });

      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      writeExecutionTrace({
        sessionId,
        toolName,
        parameters: args[0] || {},
        result: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
        durationMs,
        importance: 1, // Failed executions are more important
      });
      throw err;
    }
  }) as unknown as T;
}
