/**
 * 检查点管理器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { CheckpointError } from '../errors';
import * as zlib from 'zlib';
import { promisify } from 'util';
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
/**
 * 检查点管理器
 */
export class CheckpointManager {
    stateManager;
    constructor(stateManager) {
        this.stateManager = stateManager;
    }
    /**
     * 创建检查点
     */
    async createCheckpoint(workflow) {
        try {
            const stateData = this.serializeWorkflowState(workflow);
            const compressed = await gzip(Buffer.from(stateData));
            const checkpoint = await this.stateManager.createCheckpoint(workflow.workflowId, workflow.currentPhase, new Uint8Array(compressed));
            return checkpoint;
        }
        catch (error) {
            throw new CheckpointError('create', 'Failed to create checkpoint', error);
        }
    }
    /**
     * 恢复检查点
     */
    async restoreCheckpoint(checkpointId) {
        try {
            const checkpoint = await this.stateManager.getCheckpoint(checkpointId);
            if (!checkpoint) {
                throw new CheckpointError('restore', `Checkpoint not found: ${checkpointId}`);
            }
            const decompressed = await gunzip(Buffer.from(checkpoint.stateSnapshot));
            const stateData = JSON.parse(decompressed.toString());
            return stateData;
        }
        catch (error) {
            if (error instanceof CheckpointError) {
                throw error;
            }
            throw new CheckpointError('restore', 'Failed to restore checkpoint', error);
        }
    }
    /**
     * 恢复到最新检查点
     */
    async restoreLatestCheckpoint(workflowId) {
        const checkpoint = await this.stateManager.getLatestCheckpoint(workflowId);
        if (!checkpoint) {
            return null;
        }
        return this.restoreCheckpoint(checkpoint.checkpointId);
    }
    /**
     * 获取指定阶段的检查点
     */
    async getCheckpointByPhase(workflowId, phase) {
        const checkpoints = await this.listCheckpoints(workflowId);
        return checkpoints.find(cp => cp.phase === phase) || null;
    }
    /**
     * 列出工作流的所有检查点
     */
    async listCheckpoints(workflowId) {
        const workflow = await this.stateManager.getWorkflow(workflowId);
        if (!workflow) {
            return [];
        }
        const checkpoints = [];
        for (let phase = 1; phase <= workflow.currentPhase; phase++) {
            const cp = await this.getCheckpointByPhase(workflowId, phase);
            if (cp) {
                checkpoints.push(cp);
            }
        }
        return checkpoints;
    }
    /**
     * 清理过期检查点
     */
    async cleanupOldCheckpoints(workflowId, keepLast = 3) {
        const checkpoints = await this.listCheckpoints(workflowId);
        if (checkpoints.length <= keepLast) {
            return 0;
        }
        const toDelete = checkpoints
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(keepLast);
        for (const checkpoint of toDelete) {
            await this.stateManager.deleteCheckpoint(checkpoint.checkpointId);
        }
        return toDelete.length;
    }
    /**
     * 序列化工作流状态
     */
    serializeWorkflowState(workflow) {
        const stateData = {
            workflowId: workflow.workflowId,
            featureName: workflow.featureName,
            projectPath: workflow.projectPath,
            status: workflow.status,
            currentPhase: workflow.currentPhase,
            currentState: workflow.currentState,
            config: workflow.config,
            metadata: workflow.metadata,
            version: workflow.version
        };
        return JSON.stringify(stateData);
    }
    /**
     * 计算检查点大小（KB）
     */
    getCheckpointSizeKB(checkpoint) {
        return Math.round(checkpoint.sizeBytes / 1024);
    }
    /**
     * 验证检查点完整性
     */
    async validateCheckpoint(checkpointId) {
        try {
            const state = await this.restoreCheckpoint(checkpointId);
            return !!state && !!state.workflowId && !!state.currentState;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=checkpoint-manager.js.map