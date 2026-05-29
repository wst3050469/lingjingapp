import { spawn, type ChildProcess } from 'node:child_process';
import type { PipelineDefinition, PipelineRun, StageResult, TaskResult, PipelineLogEvent, TaskStatus } from './types.js';

export interface EngineCallbacks {
    onStatusChange?: (runId: string, status: string) => void;
    onLog?: (event: PipelineLogEvent) => void;
    onDangerousCommand?: (command: string) => Promise<boolean>;
}

const DANGEROUS_PATTERNS: RegExp[] = [
    /rm\s+-rf\s+\//,
    /rm\s+-rf\s+~/,
    /rm\s+-rf\s+\*/,
    /del\s+\/[sq]\s+[Cc]:\\/i,
    /format\s+[Cc]:\\/i,
    /:\(\)\{\s*:\|:&\s*\}/,
];

function isDangerousCommand(cmd: string): boolean {
    return DANGEROUS_PATTERNS.some(p => p.test(cmd));
}

export class PipelineEngine {
    private activeProcesses = new Map<string, ChildProcess>();
    private callbacks: EngineCallbacks;
    private runningPipelines = new Map<string, boolean>();

    constructor(callbacks: EngineCallbacks = {}) {
        this.callbacks = callbacks;
    }

    async execute(
        definition: PipelineDefinition,
        triggerType: string = 'manual',
        triggerInfo?: string,
    ): Promise<PipelineRun> {
        const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const run: PipelineRun = {
            id: runId,
            pipelineId: definition.id,
            triggerType: triggerType as PipelineRun['triggerType'],
            triggerInfo,
            status: 'running',
            stagesResult: [],
            startedAt: new Date().toISOString(),
        };

        this.runningPipelines.set(runId, true);
        this.callbacks.onStatusChange?.(runId, 'running');

        try {
            const sortedStages = [...definition.stages].sort((a, b) => a.order - b.order);

            for (const stage of sortedStages) {
                if (!this.runningPipelines.get(runId)) {
                    run.status = 'cancelled';
                    break;
                }

                const stageResult = await this.executeStage(stage, runId);
                run.stagesResult.push(stageResult);

                if (stageResult.status === 'failed' && !stage.continueOnError) {
                    run.status = 'failed';
                    break;
                }
            }

            if (run.status === 'running') run.status = 'success';
        } catch (err) {
            run.status = 'failed';
            this.emitLog(runId, undefined, undefined, 'system', `Pipeline error: ${err}`);
        }

        run.finishedAt = new Date().toISOString();
        run.durationMs = Date.now() - new Date(run.startedAt!).getTime();
        this.runningPipelines.delete(runId);
        this.callbacks.onStatusChange?.(runId, run.status);
        return run;
    }

    private async executeStage(
        stage: PipelineDefinition['stages'][number],
        runId: string,
    ): Promise<StageResult> {
        this.emitLog(runId, stage.name, undefined, 'system', `Stage started: ${stage.name}`);

        const result: StageResult = {
            stageName: stage.name,
            order: stage.order,
            status: 'running' as TaskStatus,
            taskResults: [],
            startedAt: new Date().toISOString(),
        };

        const taskPromises = stage.tasks.map(task =>
            this.executeTask(task, runId, stage.name),
        );
        const taskResults = await Promise.allSettled(taskPromises);

        result.taskResults = taskResults.map((r, i) =>
            r.status === 'fulfilled'
                ? r.value
                : {
                      taskName: stage.tasks[i].name,
                      status: 'failed' as TaskStatus,
                      stderr: String(r.reason),
                  },
        );

        const hasFailure = result.taskResults.some(r => r.status === 'failed');
        result.status = hasFailure ? 'failed' : 'success';
        result.finishedAt = new Date().toISOString();
        result.durationMs = Date.now() - new Date(result.startedAt!).getTime();

        this.emitLog(runId, stage.name, undefined, 'system', `Stage finished: ${stage.name} with status ${result.status}`);
        return result;
    }

    private async executeTask(
        task: PipelineDefinition['stages'][number]['tasks'][number],
        runId: string,
        stageName: string,
    ): Promise<TaskResult> {
        const retries = task.retries || 0;
        const retryDelay = task.retryDelay || 0;
        let lastResult: TaskResult = {
            taskName: task.name,
            status: 'success',
            startedAt: new Date().toISOString(),
        };

        for (let attempt = 0; attempt <= retries; attempt++) {
            if (attempt > 0) {
                this.emitLog(runId, stageName, task.name, 'system', `Retrying task: ${task.name} (Attempt ${attempt}/${retries}) after ${retryDelay}ms`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }

            if (isDangerousCommand(task.command)) {
                if (this.callbacks.onDangerousCommand) {
                    const approved = await this.callbacks.onDangerousCommand(task.command);
                    if (!approved) {
                        return {
                            taskName: task.name,
                            status: 'cancelled',
                            stderr: 'Dangerous command blocked by user',
                        };
                    }
                }
            }

            const result = await this.runTaskProcess(task, runId, stageName);
            lastResult = result;

            if (result.status === 'success') {
                return result;
            }
        }

        return lastResult;
    }

    private async runTaskProcess(
        task: PipelineDefinition['stages'][number]['tasks'][
            number
        ],
        runId: string,
        stageName: string,
    ): Promise<TaskResult> {
        const result: TaskResult = {
            taskName: task.name,
            status: 'running',
            startedAt: new Date().toISOString(),
        };

        return new Promise(resolve => {
            const timeout = task.timeout || 300000;
            const cwd = task.workingDirectory || process.cwd();
            
            const isWindows = process.platform === 'win32';
            const shell = isWindows ? 'cmd.exe' : 'sh';
            const args = isWindows ? ['/c', task.command] : ['-c', task.command];

            const proc = spawn(shell, args, {
                cwd,
                env: { ...process.env, ...task.env },
            });

            this.activeProcesses.set(`${runId}:${task.name}`, proc);

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data: Buffer) => {
                const str = data.toString();
                stdout += str;
                this.emitLog(runId, stageName, task.name, 'stdout', str);
            });

            proc.stderr?.on('data', (data: Buffer) => {
                const str = data.toString();
                stderr += str;
                this.emitLog(runId, stageName, task.name, 'stderr', str);
            });

            const timer = setTimeout(() => {
                proc.kill('SIGKILL');
                result.status = 'failed';
                result.stderr = stderr + '\n[TIMEOUT] Task exceeded timeout of ' + timeout + 'ms';
                result.exitCode = -1;
                result.finishedAt = new Date().toISOString();
                result.durationMs = Date.now() - new Date(result.startedAt!).getTime();
                this.activeProcesses.delete(`${runId}:${task.name}`);
                resolve(result);
            }, timeout);

            proc.on('close', (code: number | null) => {
                clearTimeout(timer);
                result.status = code === 0 ? 'success' : 'failed';
                result.exitCode = code ?? -1;
                result.stdout = stdout;
                result.stderr = stderr;
                result.finishedAt = new Date().toISOString();
                result.durationMs = Date.now() - new Date(result.startedAt!).getTime();
                this.activeProcesses.delete(`${runId}:${task.name}`);
                resolve(result);
            });

            proc.on('error', (err: Error) => {
                clearTimeout(timer);
                result.status = 'failed';
                result.stderr = stderr + '\n' + err.message;
                result.finishedAt = new Date().toISOString();
                this.activeProcesses.delete(`${runId}:${task.name}`);
                resolve(result);
            });
        });
    }

    cancel(runId: string): void {
        this.runningPipelines.delete(runId);
        for (const [key, proc] of this.activeProcesses.entries()) {
            if (key.startsWith(runId + ':')) {
                proc.kill('SIGKILL');
                this.activeProcesses.delete(key);
            }
        }
    }

    private emitLog(
        runId: string,
        stageName: string | undefined,
        taskName: string | undefined,
        stream: PipelineLogEvent['stream'] = 'system',
        data: string = '',
    ): void {
        this.callbacks.onLog?.({
            runId,
            stageName,
            taskName,
            stream,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    dispose(): void {
        for (const proc of this.activeProcesses.values()) proc.kill('SIGKILL');
        this.activeProcesses.clear();
        this.runningPipelines.clear();
    }
}
