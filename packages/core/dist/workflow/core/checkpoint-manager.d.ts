/**
 * 检查点管理器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { Checkpoint, WorkflowInstance, PhaseNumber } from '../types';
import { StateManager } from './state-manager';
/**
 * 检查点管理器
 */
export declare class CheckpointManager {
    private stateManager;
    constructor(stateManager: StateManager);
    /**
     * 创建检查点
     */
    createCheckpoint(workflow: WorkflowInstance): Promise<Checkpoint>;
    /**
     * 恢复检查点
     */
    restoreCheckpoint(checkpointId: string): Promise<Partial<WorkflowInstance>>;
    /**
     * 恢复到最新检查点
     */
    restoreLatestCheckpoint(workflowId: string): Promise<Partial<WorkflowInstance> | null>;
    /**
     * 获取指定阶段的检查点
     */
    getCheckpointByPhase(workflowId: string, phase: PhaseNumber): Promise<Checkpoint | null>;
    /**
     * 列出工作流的所有检查点
     */
    listCheckpoints(workflowId: string): Promise<Checkpoint[]>;
    /**
     * 清理过期检查点
     */
    cleanupOldCheckpoints(workflowId: string, keepLast?: number): Promise<number>;
    /**
     * 序列化工作流状态
     */
    private serializeWorkflowState;
    /**
     * 计算检查点大小（KB）
     */
    getCheckpointSizeKB(checkpoint: Checkpoint): number;
    /**
     * 验证检查点完整性
     */
    validateCheckpoint(checkpointId: string): Promise<boolean>;
}
//# sourceMappingURL=checkpoint-manager.d.ts.map