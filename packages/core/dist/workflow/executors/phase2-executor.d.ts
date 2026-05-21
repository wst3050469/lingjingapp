/**
 * Phase 2执行器：设计阶段
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowInstance } from '../types';
import { PhaseExecutor } from './phase-executor';
import { RequirementAnalysisResult } from './phase1-executor';
/**
 * 设计文档
 */
export interface DesignDocument {
    designId: string;
    architecture: ArchitectureDesign;
    components: ComponentDesign[];
    interfaces: InterfaceDefinition[];
    dataModels: DataModel[];
    dependencies: DependencyMapping[];
    createdAt: Date;
}
/**
 * 架构设计
 */
export interface ArchitectureDesign {
    pattern: 'MONOLITHIC' | 'MICROSERVICES' | 'LAYERED' | 'MODULAR';
    layers: ArchitecturalLayer[];
    communicationPattern: 'SYNC' | 'ASYNC' | 'HYBRID';
}
/**
 * 架构层
 */
export interface ArchitecturalLayer {
    name: string;
    responsibility: string;
    components: string[];
}
/**
 * 组件设计
 */
export interface ComponentDesign {
    componentId: string;
    name: string;
    type: 'SERVICE' | 'REPOSITORY' | 'CONTROLLER' | 'UTIL';
    responsibility: string;
    dependencies: string[];
    methods: MethodDefinition[];
}
/**
 * 方法定义
 */
export interface MethodDefinition {
    name: string;
    parameters: ParameterDefinition[];
    returnType: string;
    isAsync: boolean;
}
/**
 * 参数定义
 */
export interface ParameterDefinition {
    name: string;
    type: string;
    required: boolean;
}
/**
 * 接口定义
 */
export interface InterfaceDefinition {
    interfaceId: string;
    name: string;
    methods: MethodDefinition[];
    description: string;
}
/**
 * 数据模型
 */
export interface DataModel {
    modelId: string;
    name: string;
    fields: FieldDefinition[];
    relations: RelationDefinition[];
}
/**
 * 字段定义
 */
export interface FieldDefinition {
    name: string;
    type: string;
    required: boolean;
    primaryKey?: boolean;
    foreignKey?: boolean;
}
/**
 * 关系定义
 */
export interface RelationDefinition {
    from: string;
    to: string;
    type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
}
/**
 * 依赖映射
 */
export interface DependencyMapping {
    from: string;
    to: string;
    type: 'INTERNAL' | 'EXTERNAL';
    purpose: string;
}
/**
 * Phase 2执行器：设计阶段
 */
export declare class Phase2ExecutorEnhanced extends PhaseExecutor {
    private phase1Result?;
    constructor(workflow: WorkflowInstance, phase1Result?: RequirementAnalysisResult);
    protected validatePreconditions(): Promise<void>;
    protected executeCore(): Promise<DesignDocument>;
    private generateDesignId;
    private designArchitecture;
    private designComponents;
    private defineInterfaces;
    private designDataModels;
    private mapDependencies;
}
export { Phase2Executor } from './phase-executor';
//# sourceMappingURL=phase2-executor.d.ts.map