/**
 * 执行器协调器 - 管理阶段执行器之间的协调和依赖
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowLogger } from '../infrastructure/logger';
import { PhaseExecutionError } from '../errors';
import { Phase1ExecutorEnhanced } from './phase1-executor';
import { Phase2ExecutorEnhanced } from './phase2-executor';
import { Phase3ExecutorEnhanced } from './phase3-executor';
import { Phase4ExecutorEnhanced } from './phase4-executor';
/**
 * 执行器协调器
 */
export class ExecutorCoordinator {
    workflow;
    logger;
    phase1Result;
    phase2Result;
    phase3Result;
    phase4Result;
    constructor(workflow) {
        this.workflow = workflow;
        this.logger = new WorkflowLogger(workflow.workflowId);
    }
    /**
     * 执行指定阶段
     */
    async executePhase(phase) {
        this.logger.info(phase, `ExecutorCoordinator: Starting phase ${phase}`);
        try {
            switch (phase) {
                case 1:
                    return await this.executePhase1();
                case 2:
                    return await this.executePhase2();
                case 3:
                    return await this.executePhase3();
                case 4:
                    return await this.executePhase4();
                default:
                    throw new PhaseExecutionError(phase, `Invalid phase number: ${phase}`);
            }
        }
        catch (error) {
            this.logger.error(phase, `ExecutorCoordinator: Phase ${phase} failed`, error);
            throw error;
        }
    }
    /**
     * 执行Phase 1
     */
    async executePhase1() {
        const executor = new Phase1ExecutorEnhanced(this.workflow);
        const result = await executor.execute();
        if (result.success && result.output) {
            this.phase1Result = result.output;
            this.logger.info(1, 'Phase 1 result stored for dependency injection');
        }
        return result;
    }
    /**
     * 执行Phase 2
     */
    async executePhase2() {
        this.validatePhaseDependency(2, 1, this.phase1Result);
        const executor = new Phase2ExecutorEnhanced(this.workflow, this.phase1Result);
        const result = await executor.execute();
        if (result.success && result.output) {
            this.phase2Result = result.output;
            this.logger.info(2, 'Phase 2 result stored for dependency injection');
        }
        return result;
    }
    /**
     * 执行Phase 3
     */
    async executePhase3() {
        this.validatePhaseDependency(3, 2, this.phase2Result);
        const executor = new Phase3ExecutorEnhanced(this.workflow, this.phase2Result);
        const result = await executor.execute();
        if (result.success && result.output) {
            this.phase3Result = result.output;
            this.logger.info(3, 'Phase 3 result stored for dependency injection');
        }
        return result;
    }
    /**
     * 执行Phase 4
     */
    async executePhase4() {
        this.validatePhaseDependency(4, 3, this.phase3Result);
        const executor = new Phase4ExecutorEnhanced(this.workflow, this.phase3Result);
        const result = await executor.execute();
        if (result.success && result.output) {
            this.phase4Result = result.output;
            this.logger.info(4, 'Phase 4 result stored');
        }
        return result;
    }
    /**
     * 验证阶段依赖
     */
    validatePhaseDependency(currentPhase, requiredPhase, requiredResult) {
        if (!requiredResult) {
            throw new PhaseExecutionError(currentPhase, `Phase ${requiredPhase} must be executed before Phase ${currentPhase}`);
        }
    }
    /**
     * 获取阶段结果
     */
    getPhaseResult(phase) {
        switch (phase) {
            case 1:
                return this.phase1Result;
            case 2:
                return this.phase2Result;
            case 3:
                return this.phase3Result;
            case 4:
                return this.phase4Result;
            default:
                return undefined;
        }
    }
    /**
     * 清除所有阶段结果
     */
    clearResults() {
        this.phase1Result = undefined;
        this.phase2Result = undefined;
        this.phase3Result = undefined;
        this.phase4Result = undefined;
        this.logger.info(0, 'All phase results cleared');
    }
    /**
     * 执行多个阶段
     */
    async executePhases(startPhase, endPhase) {
        const results = [];
        for (let phase = startPhase; phase <= endPhase; phase++) {
            const result = await this.executePhase(phase);
            results.push(result);
            if (!result.success) {
                this.logger.error(phase, `Execution stopped at phase ${phase} due to failure`);
                break;
            }
        }
        return results;
    }
    /**
     * 跳过阶段（使用已有结果）
     */
    skipPhase(phase, result) {
        switch (phase) {
            case 1:
                this.phase1Result = result;
                break;
            case 2:
                this.phase2Result = result;
                break;
            case 3:
                this.phase3Result = result;
                break;
            case 4:
                this.phase4Result = result;
                break;
        }
        this.logger.info(phase, `Phase ${phase} skipped, using provided result`);
    }
}
/**
 * 执行器协调器工厂
 */
export class ExecutorCoordinatorFactory {
    static instances = new Map();
    static create(workflow) {
        let coordinator = this.instances.get(workflow.workflowId);
        if (!coordinator) {
            coordinator = new ExecutorCoordinator(workflow);
            this.instances.set(workflow.workflowId, coordinator);
        }
        return coordinator;
    }
    static get(workflowId) {
        return this.instances.get(workflowId);
    }
    static remove(workflowId) {
        return this.instances.delete(workflowId);
    }
    static clear() {
        this.instances.clear();
    }
}
//# sourceMappingURL=executor-coordinator.js.map