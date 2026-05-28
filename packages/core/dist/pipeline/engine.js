import { spawn } from 'node:child_process';
const DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+\//,
    /rm\s+-rf\s+~/,
    /rm\s+-rf\s+\*/,
    /del\s+\/[sq]\s+[Cc]:\\/i,
    /format\s+[Cc]:\\/i,
    /:\(\)\{\s*:\|:&\s*\}/,
];
function isDangerousCommand(cmd) {
    return DANGEROUS_PATTERNS.some(p => p.test(cmd));
}
export class PipelineEngine {
    activeProcesses = new Map();
    callbacks;
    runningPipelines = new Map();
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
    }
    async execute(definition, triggerType = 'manual', triggerInfo) {
        const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const run = {
            id: runId,
            pipelineId: definition.id,
            triggerType: triggerType,
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
            if (run.status === 'running')
                run.status = 'success';
        }
        catch (err) {
            run.status = 'failed';
            this.emitLog(runId, undefined, undefined, 'system', `Pipeline error: ${err}`);
        }
        run.finishedAt = new Date().toISOString();
        run.durationMs = Date.now() - new Date(run.startedAt).getTime();
        this.runningPipelines.delete(runId);
        this.callbacks.onStatusChange?.(runId, run.status);
        return run;
    }
    async executeStage(stage, runId) {
        this.emitLog(runId, stage.name, undefined, 'system', `Stage started: ${stage.name}`);
        const result = {
            stageName: stage.name,
            order: stage.order,
            status: 'running',
            taskResults: [],
            startedAt: new Date().toISOString(),
        };
        const taskPromises = stage.tasks.map(task => this.executeTask(task, runId, stage.name));
        const taskResults = await Promise.allSettled(taskPromises);
        result.taskResults = taskResults.map((r, i) => r.status === 'fulfilled'
            ? r.value
            : {
                taskName: stage.tasks[i].name,
                status: 'failed',
                stderr: String(r.reason),
            });
        const hasFailure = result.taskResults.some(r => r.status === 'failed');
        result.status = hasFailure ? 'failed' : 'success';
        result.finishedAt = new Date().toISOString();
        result.durationMs = Date.now() - new Date(result.startedAt).getTime();
        this.emitLog(runId, stage.name, undefined, 'system', `Stage finished: ${stage.name} with status ${result.status}`);
        return result;
    }
    async executeTask(task, runId, stageName) {
        const retries = task.retries || 0;
        const retryDelay = task.retryDelay || 0;
        let lastResult = {
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
    async runTaskProcess(task, runId, stageName) {
        const result = {
            taskName: task.name,
            status: 'running',
            startedAt: new Date().toISOString(),
        };
        return new Promise(resolve => {
            const timeout = task.timeout || 300000;
            const cwd = task.workingDirectory || process.cwd();
            const proc = spawn('sh', ['-c', task.command], {
                cwd,
                env: { ...process.env, ...task.env },
            });
            this.activeProcesses.set(`${runId}:${task.name}`, proc);
            let stdout = '';
            let stderr = '';
            proc.stdout?.on('data', (data) => {
                const str = data.toString();
                stdout += str;
                this.emitLog(runId, stageName, task.name, 'stdout', str);
            });
            proc.stderr?.on('data', (data) => {
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
                result.durationMs = Date.now() - new Date(result.startedAt).getTime();
                this.activeProcesses.delete(`${runId}:${task.name}`);
                resolve(result);
            }, timeout);
            proc.on('close', (code) => {
                clearTimeout(timer);
                result.status = code === 0 ? 'success' : 'failed';
                result.exitCode = code ?? -1;
                result.stdout = stdout;
                result.stderr = stderr;
                result.finishedAt = new Date().toISOString();
                result.durationMs = Date.now() - new Date(result.startedAt).getTime();
                this.activeProcesses.delete(`${runId}:${task.name}`);
                resolve(result);
            });
            proc.on('error', (err) => {
                clearTimeout(timer);
                result.status = 'failed';
                result.stderr = stderr + '\n' + err.message;
                result.finishedAt = new Date().toISOString();
                this.activeProcesses.delete(`${runId}:${task.name}`);
                resolve(result);
            });
        });
    }
    cancel(runId) {
        this.runningPipelines.delete(runId);
        for (const [key, proc] of this.activeProcesses.entries()) {
            if (key.startsWith(runId + ':')) {
                proc.kill('SIGKILL');
                this.activeProcesses.delete(key);
            }
        }
    }
    emitLog(runId, stageName, taskName, stream = 'system', data = '') {
        this.callbacks.onLog?.({
            runId,
            stageName,
            taskName,
            stream,
            data,
            timestamp: new Date().toISOString(),
        });
    }
    dispose() {
        for (const proc of this.activeProcesses.values())
            proc.kill('SIGKILL');
        this.activeProcesses.clear();
        this.runningPipelines.clear();
    }
}
//# sourceMappingURL=engine.js.map