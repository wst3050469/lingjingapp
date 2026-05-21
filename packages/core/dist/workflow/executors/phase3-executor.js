/**
 * Phase 3执行器：实现阶段
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { PhaseExecutor } from './phase-executor';
/**
 * Phase 3执行器：实现阶段
 */
export class Phase3ExecutorEnhanced extends PhaseExecutor {
    designResult;
    tasks = [];
    constructor(workflow, designResult) {
        super(3, workflow);
        this.designResult = designResult;
    }
    async validatePreconditions() {
        if (!this.designResult) {
            this.logger.warn(this.phase, 'Design result not provided, generating default implementation plan');
        }
    }
    async executeCore() {
        this.logger.info(this.phase, 'Starting implementation planning');
        const planId = this.generatePlanId();
        const tasks = await this.generateImplementationTasks();
        const executionOrder = this.calculateExecutionOrder(tasks);
        const parallelizableGroups = this.identifyParallelizableGroups(tasks);
        const estimatedEffort = this.estimateEffort(tasks);
        const result = {
            planId,
            tasks,
            executionOrder,
            parallelizableGroups,
            estimatedEffort,
            createdAt: new Date()
        };
        this.logger.info(this.phase, 'Implementation planning completed', {
            planId,
            taskCount: tasks.length,
            estimatedHours: estimatedEffort.estimatedHours
        });
        return result;
    }
    generatePlanId() {
        return `plan-${this.workflow.workflowId}-${Date.now()}`;
    }
    async generateImplementationTasks() {
        const tasks = [];
        const baseId = this.workflow.workflowId;
        tasks.push({
            taskId: `task-${baseId}-1`,
            taskName: `Create ${this.workflow.featureName} service`,
            taskType: 'CREATE_FILE',
            description: `Implement service class for ${this.workflow.featureName}`,
            filePath: `src/services/${this.workflow.featureName.toLowerCase()}.service.ts`,
            dependencies: [],
            priority: 1,
            estimatedTime: 2
        });
        tasks.push({
            taskId: `task-${baseId}-2`,
            taskName: `Create ${this.workflow.featureName} tests`,
            taskType: 'CREATE_TEST',
            description: `Write unit tests for ${this.workflow.featureName}`,
            filePath: `tests/${this.workflow.featureName.toLowerCase()}.test.ts`,
            dependencies: [`task-${baseId}-1`],
            priority: 2,
            estimatedTime: 1.5
        });
        if (this.designResult?.interfaces.length) {
            tasks.push({
                taskId: `task-${baseId}-3`,
                taskName: 'Create interface definitions',
                taskType: 'CREATE_FILE',
                description: 'Define TypeScript interfaces',
                filePath: `src/types/${this.workflow.featureName.toLowerCase()}.types.ts`,
                dependencies: [],
                priority: 1,
                estimatedTime: 0.5
            });
        }
        return tasks;
    }
    calculateExecutionOrder(tasks) {
        const visited = new Set();
        const order = [];
        const visit = (taskId) => {
            if (visited.has(taskId))
                return;
            const task = tasks.find(t => t.taskId === taskId);
            if (!task)
                return;
            visited.add(taskId);
            for (const dep of task.dependencies) {
                visit(dep);
            }
            order.push(taskId);
        };
        const sortedTasks = [...tasks].sort((a, b) => a.priority - b.priority);
        for (const task of sortedTasks) {
            visit(task.taskId);
        }
        return order;
    }
    identifyParallelizableGroups(tasks) {
        const groups = [];
        const remaining = new Set(tasks.map(t => t.taskId));
        while (remaining.size > 0) {
            const parallelizable = [];
            for (const taskId of remaining) {
                const task = tasks.find(t => t.taskId === taskId);
                if (!task)
                    continue;
                const canExecute = task.dependencies.every(dep => !remaining.has(dep));
                if (canExecute) {
                    parallelizable.push(taskId);
                }
            }
            if (parallelizable.length === 0)
                break;
            groups.push(parallelizable);
            parallelizable.forEach(id => remaining.delete(id));
        }
        return groups;
    }
    estimateEffort(tasks) {
        const totalHours = tasks.reduce((sum, t) => sum + t.estimatedTime, 0);
        const avgPriority = tasks.reduce((sum, t) => sum + t.priority, 0) / tasks.length;
        let complexity;
        if (totalHours <= 5)
            complexity = 'LOW';
        else if (totalHours <= 15)
            complexity = 'MEDIUM';
        else
            complexity = 'HIGH';
        let riskLevel;
        if (avgPriority <= 1.5)
            riskLevel = 'LOW';
        else if (avgPriority <= 2.5)
            riskLevel = 'MEDIUM';
        else
            riskLevel = 'HIGH';
        return {
            totalTasks: tasks.length,
            estimatedHours: Math.round(totalHours * 10) / 10,
            complexity,
            riskLevel
        };
    }
}
// Re-export base executors for test compatibility
export { Phase3Executor } from './phase-executor';
//# sourceMappingURL=phase3-executor.js.map