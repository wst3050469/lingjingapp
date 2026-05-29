export type TaskType = 'build' | 'test' | 'deploy' | 'lint' | 'custom';
export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'queued';
export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';
export type TriggerType = 'manual' | 'push' | 'cron' | 'watch';

export interface PipelineTrigger {
    type: TriggerType;
    branches?: string[];
    expression?: string;
    /** 文件监听配置 — 当 type='watch' 时必填 */
    watch?: WatchConfig;
}

/** 文件变更监听配置 */
export interface WatchConfig {
    /** 要监听的目录路径（可相对于项目根目录） */
    paths: string[];
    /** 文件匹配模式（glob），如 '**\/*.ts', '*.yaml' */
    patterns?: string[];
    /** 监听的事件类型：change | add | unlink，默认监听全部 */
    events?: Array<'change' | 'add' | 'unlink'>;
    /** 防抖延迟（毫秒），默认 1000ms */
    debounceMs?: number;
    /** 是否递归监听子目录，默认 true */
    recursive?: boolean;
}

export interface PipelineTask {
    name: string;
    type: TaskType;
    command: string;
    timeout?: number;
    env?: Record<string, string>;
    continueOnError?: boolean;
    workingDirectory?: string;
    sshHost?: string;
    retries?: number;
    retryDelay?: number;
}

export interface PipelineStage {
    name: string;
    order: number;
    continueOnError: boolean;
    tasks: PipelineTask[];
}

export interface PipelineDefinition {
    id: string;
    name: string;
    triggers: PipelineTrigger[];
    stages: PipelineStage[];
    yamlPath?: string;
}

export interface TaskResult {
    taskName: string;
    status: TaskStatus;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    durationMs?: number;
    startedAt?: string;
    finishedAt?: string;
}

export interface StageResult {
    stageName: string;
    order: number;
    status: TaskStatus;
    taskResults: TaskResult[];
    durationMs?: number;
    startedAt?: string;
    finishedAt?: string;
}

export interface PipelineRun {
    id: string;
    pipelineId: string;
    triggerType: TriggerType;
    triggerInfo?: string;
    status: PipelineStatus;
    stagesResult: StageResult[];
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
}

export interface PipelineLogEvent {
    runId: string;
    stageName?: string;
    taskName?: string;
    stream: 'stdout' | 'stderr' | 'system';
    data: string;
    timestamp: string;
}
