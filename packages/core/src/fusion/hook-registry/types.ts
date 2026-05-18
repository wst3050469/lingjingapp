export enum HookPoint {
  BEFORE_LLM_CALL = 'before_llm_call',
  AFTER_LLM_CALL = 'after_llm_call',
  BEFORE_TOOL_EXECUTE = 'before_tool_execute',
  AFTER_TOOL_EXECUTE = 'after_tool_execute',
  BEFORE_SKILL_LOAD = 'before_skill_load',
  AFTER_SKILL_LOAD = 'after_skill_load',
  BEFORE_MEMORY_WRITE = 'before_memory_write',
  AFTER_COMPACTION = 'after_compaction',
}

export interface HookContext<T = unknown> {
  point: HookPoint;
  data: T;
  original: Readonly<T>;
}

export type HookCallback<T = unknown> = (context: HookContext<T>) => HookContext<T> | Promise<HookContext<T>>;

export interface HookOptions {
  priority?: number;
  mode?: 'sync' | 'async';
  timeout?: number;
}

export interface HookEntry {
  id: string;
  point: HookPoint;
  callback: HookCallback;
  options: HookOptions;
}

export interface IHookRegistry {
  register<T>(point: HookPoint, callback: HookCallback<T>, options?: HookOptions): string;
  unregister(id: string): boolean;
  execute<T>(point: HookPoint, data: T): Promise<HookContext<T>>;
  healthCheck(): { healthy: boolean; hookCount: number };
}
