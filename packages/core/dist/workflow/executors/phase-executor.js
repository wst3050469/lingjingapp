/**
 * 阶段执行器基类
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { PhaseExecutionError, TimeoutError } from '../errors';
import { WorkflowLogger } from '../infrastructure/logger';
/**
 * 阶段执行器抽象基类
 */
export class PhaseExecutor {
    phase;
    workflow;
    logger;
    constructor(phase, workflow) {
        this.phase = phase;
        this.workflow = workflow;
        this.logger = new WorkflowLogger(workflow?.workflowId || 'phase-executor');
    }
    /**
     * 执行阶段
     */
    async execute() {
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;
        try {
            this.logger.info(this.phase, `Phase ${this.phase} execution started`);
            await this.validatePreconditions();
            const result = await this.executeWithTimeout();
            const metrics = this.calculateMetrics(startTime, startMemory);
            this.logger.info(this.phase, `Phase ${this.phase} execution completed`, { metrics });
            return {
                success: true,
                output: result,
                metrics
            };
        }
        catch (error) {
            const metrics = this.calculateMetrics(startTime, startMemory);
            this.logger.error(this.phase, `Phase ${this.phase} execution failed`, error, { metrics });
            return {
                success: false,
                error: error,
                metrics
            };
        }
    }
    /**
     * 执行前置条件验证
     */
    async validatePreconditions() {
        // 子类可以重写此方法实现自定义验证逻辑
    }
    /**
     * 执行后置处理
     */
    async postExecute(result) {
        // 子类可以重写此方法实现自定义后置处理逻辑
    }
    /**
     * 带超时的执行
     */
    async executeWithTimeout() {
        const timeout = this.getTimeout();
        const phaseName = `Phase ${this.phase}`;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new TimeoutError(phaseName, timeout));
            }, timeout);
            this.executeCore()
                .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    /**
     * 获取超时时间
     */
    getTimeout() {
        const phaseConfig = this.workflow.config.phaseConfigs?.[this.phase];
        return phaseConfig?.timeout || this.workflow.config.timeout;
    }
    /**
     * 计算性能指标
     */
    calculateMetrics(startTime, startMemory) {
        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;
        return {
            durationMs: endTime - startTime,
            memoryUsedMB: Math.round((endMemory - startMemory) / 1024 / 1024)
        };
    }
    /**
     * 获取阶段编号
     */
    getPhase() {
        return this.phase;
    }
    /**
     * 获取工作流实例
     */
    getWorkflow() {
        return this.workflow;
    }
}
/**
 * Phase 1执行器：需求规格设计
 */
export class Phase1Executor extends PhaseExecutor {
    constructor(workflow, ...args) {
        super(1, workflow);
    }
    async executeCore() {
        this.logger.info(this.phase, 'Generating requirement specification');
        const spec = {
            featureName: this.workflow.featureName,
            projectPath: this.workflow.projectPath,
            requirement: this.workflow.metadata?.requirement,
            createdAt: new Date().toISOString()
        };
        return spec;
    }
}
/**
 * Phase 2执行器：实现方案创建
 */
export class Phase2Executor extends PhaseExecutor {
    constructor(workflow, ...args) {
        super(2, workflow);
    }
    async executeCore() {
        this.logger.info(this.phase, 'Creating implementation design');
        const design = {
            architecture: 'TBD',
            components: [],
            interfaces: [],
            createdAt: new Date().toISOString()
        };
        return design;
    }
}
/**
 * Phase 3执行器：编码任务规划
 */
export class Phase3Executor extends PhaseExecutor {
    constructor(workflow, ...args) {
        super(3, workflow);
    }
    async executeCore() {
        this.logger.info(this.phase, 'Planning coding tasks');
        const tasks = {
            tasks: [],
            dependencies: {},
            priorities: {},
            createdAt: new Date().toISOString()
        };
        return tasks;
    }
}
/**
 * Phase 4执行器：任务执行
 */
export class Phase4Executor extends PhaseExecutor {
    constructor(workflow, ...args) {
        super(4, workflow);
    }
    async executeCore() {
        this.logger.info(this.phase, 'Executing coding tasks');
        const results = {
            completedTasks: 0,
            failedTasks: 0,
            outputs: [],
            createdAt: new Date().toISOString()
        };
        return results;
    }
}
/**
 * 阶段执行器工厂
 */
export class PhaseExecutorFactory {
    static createExecutor(phase, workflow) {
        switch (phase) {
            case 1:
                return new Phase1Executor(workflow);
            case 2:
                return new Phase2Executor(workflow);
            case 3:
                return new Phase3Executor(workflow);
            case 4:
                return new Phase4Executor(workflow);
            default:
                throw new PhaseExecutionError(phase, `Invalid phase number: ${phase}`);
        }
    }
}
//# sourceMappingURL=phase-executor.js.map