/**
 * Phase 1执行器：需求分析阶段
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowInstance } from '../types';
import { PhaseExecutor } from './phase-executor';
/**
 * 需求分析结果
 */
export interface RequirementAnalysisResult {
    specId: string;
    featureName: string;
    userStories: UserStory[];
    acceptanceCriteria: AcceptanceCriteria[];
    dependencies: string[];
    constraints: TechnicalConstraint[];
    estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
    createdAt: Date;
}
/**
 * 用户故事
 */
export interface UserStory {
    id: string;
    asA: string;
    iWant: string;
    soThat: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}
/**
 * 验收标准
 */
export interface AcceptanceCriteria {
    id: string;
    description: string;
    testType: 'UNIT' | 'INTEGRATION' | 'E2E';
}
/**
 * 技术约束
 */
export interface TechnicalConstraint {
    type: 'PERFORMANCE' | 'SECURITY' | 'COMPATIBILITY' | 'RESOURCE';
    description: string;
    value?: any;
}
/**
 * Phase 1执行器：需求分析阶段
 */
export declare class Phase1ExecutorEnhanced extends PhaseExecutor {
    private tasks;
    constructor(workflow: WorkflowInstance);
    protected validatePreconditions(): Promise<void>;
    protected executeCore(): Promise<RequirementAnalysisResult>;
    private generateSpecId;
    private analyzeUserStories;
    private defineAcceptanceCriteria;
    private identifyDependencies;
    private analyzeConstraints;
    private estimateComplexity;
}
export { Phase1Executor, Phase2Executor, Phase3Executor, Phase4Executor } from './phase-executor';
//# sourceMappingURL=phase1-executor.d.ts.map