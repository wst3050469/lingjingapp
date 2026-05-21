/**
 * Phase 4执行器：验证阶段
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TaskExecutionError } from '../errors';
import { PhaseExecutor } from './phase-executor';
/**
 * Phase 4执行器：验证阶段
 */
export class Phase4ExecutorEnhanced extends PhaseExecutor {
    implementationPlan;
    taskResults = [];
    constructor(workflow, implementationPlan) {
        super(4, workflow);
        this.implementationPlan = implementationPlan;
    }
    async validatePreconditions() {
        if (!this.implementationPlan) {
            this.logger.warn(this.phase, 'Implementation plan not provided, executing validation only');
        }
    }
    async executeCore() {
        this.logger.info(this.phase, 'Starting validation phase');
        const validationId = this.generateValidationId();
        const startTime = Date.now();
        if (this.implementationPlan) {
            await this.executeTasks(this.implementationPlan.tasks);
        }
        const summary = this.calculateSummary(startTime);
        const artifacts = await this.collectArtifacts();
        const result = {
            validationId,
            taskResults: this.taskResults,
            summary,
            artifacts,
            createdAt: new Date()
        };
        this.logger.info(this.phase, 'Validation phase completed', {
            validationId,
            successRate: summary.successRate,
            totalTasks: summary.totalTasks
        });
        return result;
    }
    generateValidationId() {
        return `validation-${this.workflow.workflowId}-${Date.now()}`;
    }
    async executeTasks(tasks) {
        const executionOrder = this.implementationPlan.executionOrder;
        for (const taskId of executionOrder) {
            const task = tasks.find(t => t.taskId === taskId);
            if (!task)
                continue;
            const result = await this.executeTask(task);
            this.taskResults.push(result);
            if (!result.success && !this.shouldContinueOnFailure(task)) {
                this.logger.error(this.phase, `Task ${task.taskName} failed, stopping execution`, new Error(result.error || 'Unknown error'));
                break;
            }
        }
    }
    async executeTask(task) {
        const startTime = Date.now();
        let retryCount = 0;
        const maxRetries = this.workflow.config.maxRetries;
        this.logger.info(this.phase, `Executing task: ${task.taskName}`);
        while (retryCount <= maxRetries) {
            try {
                const output = await this.simulateTaskExecution(task);
                const durationMs = Date.now() - startTime;
                this.logger.info(this.phase, `Task ${task.taskName} completed`, {
                    durationMs,
                    retryCount
                });
                return {
                    taskId: task.taskId,
                    taskName: task.taskName,
                    success: true,
                    output,
                    durationMs,
                    retryCount
                };
            }
            catch (error) {
                retryCount++;
                if (retryCount > maxRetries) {
                    const durationMs = Date.now() - startTime;
                    this.logger.error(this.phase, `Task ${task.taskName} failed after ${retryCount} retries`, error);
                    return {
                        taskId: task.taskId,
                        taskName: task.taskName,
                        success: false,
                        error: error.message,
                        durationMs,
                        retryCount
                    };
                }
                this.logger.warn(this.phase, `Task ${task.taskName} failed, retrying (${retryCount}/${maxRetries})`);
                await this.delay(1000 * retryCount);
            }
        }
        throw new TaskExecutionError(task.taskId, 'Max retries exceeded');
    }
    async simulateTaskExecution(task) {
        await this.delay(100);
        return {
            taskId: task.taskId,
            status: 'COMPLETED',
            message: `Task ${task.taskName} executed successfully`
        };
    }
    shouldContinueOnFailure(task) {
        return task.taskType === 'CREATE_TEST';
    }
    calculateSummary(startTime) {
        const successfulTasks = this.taskResults.filter(r => r.success).length;
        const failedTasks = this.taskResults.filter(r => !r.success).length;
        const totalTasks = this.taskResults.length;
        return {
            totalTasks,
            successfulTasks,
            failedTasks,
            skippedTasks: 0,
            totalDurationMs: Date.now() - startTime,
            successRate: totalTasks > 0 ? Math.round((successfulTasks / totalTasks) * 100) : 0
        };
    }
    async collectArtifacts() {
        const artifacts = [];
        for (const result of this.taskResults) {
            if (result.success && result.output) {
                artifacts.push({
                    artifactId: `artifact-${result.taskId}`,
                    type: 'FILE',
                    path: `output/${result.taskId}`,
                    description: `Generated artifact for ${result.taskName}`
                });
            }
        }
        return artifacts;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
// Re-export base executors for test compatibility
export { Phase4Executor } from './phase-executor';
//# sourceMappingURL=phase4-executor.js.map