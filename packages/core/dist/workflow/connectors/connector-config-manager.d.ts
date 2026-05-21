/**
 * Connector配置验证和安全存储
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ConnectorConfig } from '../types';
/**
 * 验证结果
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * 加密的配置数据
 */
export interface EncryptedConfig {
    encryptedData: string;
    iv: string;
    authTag: string;
    algorithm: string;
    createdAt: Date;
}
/**
 * Connector配置管理器
 */
export declare class ConnectorConfigManager {
    private logger;
    private configStore;
    private encryptedStore;
    private static instance?;
    private constructor();
    static getInstance(): ConnectorConfigManager;
    /**
     * 验证Connector配置
     */
    validateConfig(config: ConnectorConfig): ValidationResult;
    /**
     * 验证类型特定配置
     */
    private validateTypeSpecificConfig;
    /**
     * 存储配置（加密敏感信息）
     */
    storeConfig(config: ConnectorConfig): Promise<void>;
    /**
     * 获取配置（解密敏感信息）
     */
    getConfig(connectorId: string): Promise<ConnectorConfig | undefined>;
    /**
     * 删除配置
     */
    deleteConfig(connectorId: string): Promise<void>;
    /**
     * 清理敏感信息
     */
    private sanitizeConfig;
    /**
     * 加密认证信息
     */
    private encryptAuthInfo;
    /**
     * 解密认证信息
     */
    private decryptAuthInfo;
    /**
     * 获取加密密钥
     */
    private getEncryptionKey;
    /**
     * ArrayBuffer转Base64
     */
    private arrayBufferToBase64;
    /**
     * Base64转ArrayBuffer
     */
    private base64ToArrayBuffer;
    /**
     * 验证Connector类型
     */
    private isValidConnectorType;
    /**
     * 获取所有配置ID
     */
    getAllConfigIds(): string[];
    /**
     * 清理所有配置
     */
    clearAll(): Promise<void>;
}
export declare const connectorConfigManager: ConnectorConfigManager;
//# sourceMappingURL=connector-config-manager.d.ts.map