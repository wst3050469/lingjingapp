/**
 * 工作流配置加载和验证工具
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowConfig } from '../types';
/**
 * 配置加载器
 */
export declare class ConfigLoader {
    /**
     * 从JSON对象加载配置
     */
    loadFromObject(obj: any): WorkflowConfig;
    /**
     * 从环境变量加载配置
     */
    loadFromEnv(): Partial<WorkflowConfig>;
    /**
     * 验证配置
     */
    validate(config: any): WorkflowConfig;
    /**
     * 验证单个字段
     */
    private validateField;
    /**
     * 合并配置（默认 + 用户配置）
     */
    mergeWithDefaults(userConfig?: Partial<WorkflowConfig>): WorkflowConfig;
    /**
     * 合并阶段配置
     */
    private mergePhaseConfigs;
    /**
     * 获取默认配置
     */
    getDefaults(): WorkflowConfig;
}
/**
 * 全局配置加载器实例
 */
export declare const workflowConfigLoader: ConfigLoader;
//# sourceMappingURL=config.d.ts.map