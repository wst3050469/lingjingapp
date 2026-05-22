/** Workflow requirement for starting a new workflow */
export interface WorkflowRequirement {
  featureName?: string;
  requirement?: string;
  projectPath?: string;
  goal?: string;
  context?: Record<string, unknown>;
  constraints?: string[];
  priority?: 'low' | 'normal' | 'high';
  model?: string;
}

/** Progress information emitted during workflow execution */
export interface ProgressInfo {
  workflowId: string;
  phase: string;
  progress: number;
  message: string;
  detail?: string;
}

/** Possible workflow statuses */
export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/** Full workflow state */
export interface WorkflowState {
  id: string;
  requirement: WorkflowRequirement;
  status: WorkflowStatus;
  createdAt: number;
  updatedAt: number;
  progress: number;
  result?: string;
  error?: string;
}

/** Task execution status */
export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
}

/** Workflow instance */
export interface WorkflowInstance {
  id: string;
  requirement: WorkflowRequirement;
  status: WorkflowStatus;
  createdAt: number;
  updatedAt: number;
  progress: number;
  result?: string;
  error?: string;
  designDocument?: Record<string, unknown>;
  implementationPlan?: Record<string, unknown>;
}

/** Phase result */
export interface PhaseResult {
  phase: string;
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: Record<string, unknown>;
  durationMs?: number;
}

/** Workflow configuration */
export interface WorkflowConfig {
  maxRetries: number;
  timeoutMs: number;
  model: string;
  temperature: number;
  maxTokens: number;
  enableStreaming: boolean;
  enableTracing: boolean;
  phaseConfigs?: Partial<Record<PhaseNumber, PhaseConfig>>;
}

/** Phase number type */
export type PhaseNumber = 0 | 1 | 2 | 3 | 4;

/** Phase config */
export interface PhaseConfig {
  enabled: boolean;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  temperature?: number;
}

/** Log level */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/** Trigger type */
export enum TriggerType {
  MANUAL = "manual",
  SCHEDULED = "scheduled",
  EVENT = "event",
  WEBHOOK = "webhook",
}

/** Trigger config */
export interface TriggerConfig {
  type: TriggerType;
  id: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

/** Trigger status */
export enum TriggerStatus {
  ACTIVE = "active",
  PAUSED = "paused",
  ERROR = "error",
  DISABLED = "disabled",
}
