/**
 * 工作流配置加载和验证工具
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ValidationError } from '../errors';
/**
 * 配置加载器
 */
export class ConfigLoader {
    /**
     * 从JSON对象加载配置
     */
    loadFromObject(obj) {
        const merged = this.mergeWithDefaults(obj);
        return this.validate(merged);
    }
    /**
     * 从环境变量加载配置
     */
    loadFromEnv() {
        const config = {};
        if (process.env.WORKFLOW_ENABLE_ROLLBACK !== undefined) {
            config.enableRollback = process.env.WORKFLOW_ENABLE_ROLLBACK === 'true';
        }
        if (process.env.WORKFLOW_MAX_RETRIES !== undefined) {
            config.maxRetries = parseInt(process.env.WORKFLOW_MAX_RETRIES, 10);
        }
        if (process.env.WORKFLOW_TIMEOUT !== undefined) {
            config.timeout = parseInt(process.env.WORKFLOW_TIMEOUT, 10);
        }
        if (process.env.WORKFLOW_CHECKPOINT_INTERVAL !== undefined) {
            config.checkpointInterval = parseInt(process.env.WORKFLOW_CHECKPOINT_INTERVAL, 10);
        }
        return config;
    }
    /**
     * 验证配置
     */
    validate(config) {
        const schema = {
            enableRollback: { required: true, type: 'boolean' },
            maxRetries: { required: true, type: 'number', min: 0, max: 10 },
            timeout: { required: true, type: 'number', min: 1000 },
            checkpointInterval: { required: false, type: 'number', min: 10000 }
        };
        for (const [field, rule] of Object.entries(schema)) {
            this.validateField(config, field, rule);
        }
        return config;
    }
    /**
     * 验证单个字段
     */
    validateField(config, field, rule) {
        const value = config[field];
        if (rule.required && value === undefined) {
            throw new ValidationError(`Missing required field: ${field}`, field);
        }
        if (value !== undefined) {
            if (rule.type && typeof value !== rule.type) {
                throw new ValidationError(`Invalid type for field ${field}: expected ${rule.type}, got ${typeof value}`, field, value);
            }
            if (rule.type === 'number') {
                if (rule.min !== undefined && value < rule.min) {
                    throw new ValidationError(`Field ${field} must be >= ${rule.min}, got ${value}`, field, value);
                }
                if (rule.max !== undefined && value > rule.max) {
                    throw new ValidationError(`Field ${field} must be <= ${rule.max}, got ${value}`, field, value);
                }
            }
            if (rule.enum && !rule.enum.includes(value)) {
                throw new ValidationError(`Field ${field} must be one of: ${rule.enum.join(', ')}`, field, value);
            }
        }
    }
    /**
     * 合并配置（默认 + 用户配置）
     */
    mergeWithDefaults(userConfig) {
        const defaults = {
            enableRollback: true,
            maxRetries: 3,
            timeout: 3600000, // 1小时
            checkpointInterval: 300000 // 5分钟
        };
        if (!userConfig) {
            return defaults;
        }
        return {
            ...defaults,
            ...userConfig,
            phaseConfigs: this.mergePhaseConfigs(defaults.phaseConfigs, userConfig.phaseConfigs)
        };
    }
    /**
     * 合并阶段配置
     */
    mergePhaseConfigs(defaults, user) {
        if (!defaults && !user) {
            return undefined;
        }
        const merged = {};
        for (const phase of [0, 1, 2, 3, 4]) {
            const defaultPhase = defaults?.[phase];
            const userPhase = user?.[phase];
            if (defaultPhase || userPhase) {
                merged[phase] = {
                    ...defaultPhase,
                    ...userPhase
                };
            }
        }
        return merged;
    }
    /**
     * 获取默认配置
     */
    getDefaults() {
        return this.mergeWithDefaults();
    }
}
/**
 * 全局配置加载器实例
 */
export const workflowConfigLoader = new ConfigLoader();
//# sourceMappingURL=config.js.map