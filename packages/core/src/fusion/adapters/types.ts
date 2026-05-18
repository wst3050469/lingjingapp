export interface ChatRequest {
  messages: Message[];
  tools?: ToolSchema[];
  toolChoice?: 'auto' | 'required' | 'none';
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export interface ToolContext {
  sessionId: string;
  conversationId: string;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolLifecycle {
  init?(): Promise<void>;
  destroy?(): Promise<void>;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  chat(request: ChatRequest): AsyncIterable<StreamEvent>;
}

export type StreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'reasoning_delta'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; args: string }
  | { type: 'tool_call_end'; id: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'done' };

export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  riskLevel?: RiskLevel;
  lifecycle?: ToolLifecycle;
  mcpSource?: string;
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export interface IToolRegistry {
  register(tool: Tool, mcpServerName?: string): void;
  get(name: string): Tool | undefined;
  has(name: string): boolean;
  getAll(): Tool[];
  readonly size: number;
}

export interface SkillConfig {
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  instructions: string;
  level: 'user' | 'project' | 'auto-generated';
  path: string;
}

export interface ILLMAdapter {
  readonly version: string;
  chat(request: ChatRequest): AsyncIterable<StreamEvent>;
  getModel(): string;
  getName(): string;
}

export interface IMemoryAdapter {
  readonly version: string;
  write(key: string, value: unknown, scope?: string): Promise<void>;
  read(key: string, scope?: string): Promise<unknown | undefined>;
  delete(key: string, scope?: string): Promise<void>;
  list(scope?: string): Promise<Array<{ key: string; value: unknown }>>;
}

export interface ISkillAdapter {
  readonly version: string;
  load(config: SkillConfig): Promise<void>;
  unload(name: string): Promise<void>;
  get(name: string): SkillConfig | undefined;
  getAll(): SkillConfig[];
}

export interface IToolAdapter {
  readonly version: string;
  register(tool: Tool, mcpServerName?: string): void;
  get(name: string): Tool | undefined;
  has(name: string): boolean;
  getAll(): Tool[];
}

export interface SchedulerTask {
  id: string;
  cronExpression: string;
  taskType: string;
  taskConfig: Record<string, unknown>;
  enabled: boolean;
}

export interface ISchedulerAdapter {
  readonly version: string;
  register(task: SchedulerTask): Promise<string>;
  unregister(id: string): Promise<boolean>;
  trigger(id: string): Promise<void>;
  list(): Promise<SchedulerTask[]>;
}
