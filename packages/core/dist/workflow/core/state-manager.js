/**
 * 工作流状态管理器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowState, WorkflowStatus } from '../types';
import { CheckpointError, ValidationError } from '../errors';
/**
 * 状态管理器
 */
export class StateManager {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * 生成唯一ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    /**
     * 创建工作流实例
     */
    async createWorkflow(definition, config) {
        if (!definition.featureName || !definition.projectPath || !definition.requirement) {
            throw new ValidationError('Missing required fields in workflow definition');
        }
        const workflow = {
            workflowId: this.generateId(),
            featureName: definition.featureName,
            projectPath: definition.projectPath,
            status: WorkflowStatus.RUNNING,
            currentPhase: 0,
            currentState: WorkflowState.IDLE,
            config: config,
            metadata: {
                requirement: definition.requirement
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1
        };
        await this.db.run(`INSERT INTO workflow_instances 
       (workflow_id, feature_name, project_path, status, current_phase, current_state, config, metadata, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            workflow.workflowId,
            workflow.featureName,
            workflow.projectPath,
            workflow.status,
            workflow.currentPhase,
            workflow.currentState,
            JSON.stringify(workflow.config),
            JSON.stringify(workflow.metadata),
            workflow.createdAt.toISOString(),
            workflow.updatedAt.toISOString(),
            workflow.version
        ]);
        return workflow;
    }
    /**
     * 读取工作流实例
     */
    async getWorkflow(workflowId) {
        const row = await this.db.get('SELECT * FROM workflow_instances WHERE workflow_id = ?', [workflowId]);
        if (!row) {
            return null;
        }
        return this.rowToWorkflow(row);
    }
    /**
     * 更新工作流状态
     */
    async updateWorkflowState(workflowId, newState) {
        const currentPhase = this.extractPhaseFromState(newState);
        await this.db.run(`UPDATE workflow_instances 
       SET current_state = ?, current_phase = ?, updated_at = ?, version = version + 1
       WHERE workflow_id = ?`, [newState, currentPhase, new Date().toISOString(), workflowId]);
    }
    /**
     * 更新工作流状态
     */
    async updateWorkflowStatus(workflowId, status) {
        await this.db.run(`UPDATE workflow_instances 
       SET status = ?, updated_at = ?, version = version + 1
       WHERE workflow_id = ?`, [status, new Date().toISOString(), workflowId]);
    }
    /**
     * 删除工作流实例
     */
    async deleteWorkflow(workflowId) {
        await this.db.run('DELETE FROM workflow_instances WHERE workflow_id = ?', [workflowId]);
    }
    /**
     * 查询工作流列表
     */
    async listWorkflows(filter) {
        let sql = 'SELECT * FROM workflow_instances WHERE 1=1';
        const params = [];
        if (filter?.status) {
            sql += ' AND status = ?';
            params.push(filter.status);
        }
        if (filter?.featureName) {
            sql += ' AND feature_name = ?';
            params.push(filter.featureName);
        }
        sql += ' ORDER BY created_at DESC';
        if (filter?.limit) {
            sql += ' LIMIT ?';
            params.push(filter.limit);
        }
        if (filter?.offset) {
            sql += ' OFFSET ?';
            params.push(filter.offset);
        }
        const rows = await this.db.all(sql, params);
        return rows.map(row => this.rowToWorkflow(row));
    }
    /**
     * 创建检查点
     */
    async createCheckpoint(workflowId, phase, stateSnapshot) {
        const checkpoint = {
            checkpointId: this.generateId(),
            workflowId,
            phase,
            stateSnapshot,
            sizeBytes: stateSnapshot.length,
            createdAt: new Date()
        };
        try {
            await this.db.run(`INSERT INTO workflow_checkpoints 
         (checkpoint_id, workflow_id, phase, state_snapshot, size_bytes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`, [
                checkpoint.checkpointId,
                checkpoint.workflowId,
                checkpoint.phase,
                Buffer.from(checkpoint.stateSnapshot),
                checkpoint.sizeBytes,
                checkpoint.createdAt.toISOString()
            ]);
            return checkpoint;
        }
        catch (error) {
            throw new CheckpointError('create', 'Failed to create checkpoint', error);
        }
    }
    /**
     * 读取检查点
     */
    async getCheckpoint(checkpointId) {
        const row = await this.db.get('SELECT * FROM workflow_checkpoints WHERE checkpoint_id = ?', [checkpointId]);
        if (!row) {
            return null;
        }
        return {
            checkpointId: row.checkpoint_id,
            workflowId: row.workflow_id,
            phase: row.phase,
            stateSnapshot: new Uint8Array(row.state_snapshot),
            sizeBytes: row.size_bytes,
            createdAt: new Date(row.created_at)
        };
    }
    /**
     * 获取工作流的最新检查点
     */
    async getLatestCheckpoint(workflowId) {
        const row = await this.db.get(`SELECT * FROM workflow_checkpoints 
       WHERE workflow_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`, [workflowId]);
        if (!row) {
            return null;
        }
        return {
            checkpointId: row.checkpoint_id,
            workflowId: row.workflow_id,
            phase: row.phase,
            stateSnapshot: new Uint8Array(row.state_snapshot),
            sizeBytes: row.size_bytes,
            createdAt: new Date(row.created_at)
        };
    }
    /**
     * 删除检查点
     */
    async deleteCheckpoint(checkpointId) {
        await this.db.run('DELETE FROM workflow_checkpoints WHERE checkpoint_id = ?', [checkpointId]);
    }
    /**
     * 数据库行转工作流对象
     */
    rowToWorkflow(row) {
        return {
            workflowId: row.workflow_id,
            featureName: row.feature_name,
            projectPath: row.project_path,
            status: row.status,
            currentPhase: row.current_phase,
            currentState: row.current_state,
            config: JSON.parse(row.config),
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            version: row.version
        };
    }
    /**
     * 从状态提取阶段编号
     */
    extractPhaseFromState(state) {
        const match = state.match(/PHASE(\d)_/);
        return match ? parseInt(match[1], 10) : 0;
    }
}
//# sourceMappingURL=state-manager.js.map