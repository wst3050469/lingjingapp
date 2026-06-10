/**
 * 工作流状态管理器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowInstance, WorkflowDefinition, Checkpoint, WorkflowState, WorkflowStatus, PhaseNumber } from '../types';
/**
 * 数据库接口（简化定义）
 */
interface Database {
    run(sql: string, params?: any[]): Promise<void>;
    get(sql: string, params?: any[]): Promise<any>;
    all(sql: string, params?: any[]): Promise<any[]>;
}
/**
 * 状态管理器
 */
export declare class StateManager {
    private db;
    constructor(db: Database);
    /**
     * 生成唯一ID
     */
    private generateId;
    /**
     * 创建工作流实例
     */
    createWorkflow(definition: WorkflowDefinition, config: any): Promise<WorkflowInstance>;
    /**
     * 读取工作流实例
     */
    getWorkflow(workflowId: string): Promise<WorkflowInstance | null>;
    /**
     * 更新工作流状态
     */
    updateWorkflowState(workflowId: string, newState: WorkflowState): Promise<void>;
    /**
     * 更新工作流状态
     */
    updateWorkflowStatus(workflowId: string, status: WorkflowStatus): Promise<void>;
    /**
     * 删除工作流实例
     */
    deleteWorkflow(workflowId: string): Promise<void>;
    /**
     * 查询工作流列表
     */
    listWorkflows(filter?: {
        status?: WorkflowStatus;
        featureName?: string;
        limit?: number;
        offset?: number;
    }): Promise<WorkflowInstance[]>;
    /**
     * 创建检查点
     */
    createCheckpoint(workflowId: string, phase: PhaseNumber, stateSnapshot: Uint8Array): Promise<Checkpoint>;
    /**
     * 读取检查点
     */
    getCheckpoint(checkpointId: string): Promise<Checkpoint | null>;
    /**
     * 获取工作流的最新检查点
     */
    getLatestCheckpoint(workflowId: string): Promise<Checkpoint | null>;
    /**
     * 删除检查点
     */
    deleteCheckpoint(checkpointId: string): Promise<void>;
    /**
     * 数据库行转工作流对象
     */
    private rowToWorkflow;
    /**
     * 从状态提取阶段编号
     */
    private extractPhaseFromState;
}
export {};
//# sourceMappingURL=state-manager.d.ts.map