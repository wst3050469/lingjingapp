/**
 * Connector配置验证和安全存储
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ConnectorType } from '../types';
import { WorkflowLogger } from '../infrastructure/logger';
import { ConfigurationError } from '../errors';
/**
 * Connector配置管理器
 */
export class ConnectorConfigManager {
    logger;
    configStore = new Map();
    encryptedStore = new Map();
    static instance;
    constructor() {
        this.logger = new WorkflowLogger('connector-config-manager');
    }
    static getInstance() {
        if (!ConnectorConfigManager.instance) {
            ConnectorConfigManager.instance = new ConnectorConfigManager();
        }
        return ConnectorConfigManager.instance;
    }
    /**
     * 验证Connector配置
     */
    validateConfig(config) {
        const errors = [];
        const warnings = [];
        if (!config.connectorId || config.connectorId.trim() === '') {
            errors.push('Connector ID is required');
        }
        if (!config.connectorName || config.connectorName.trim() === '') {
            errors.push('Connector name is required');
        }
        if (!this.isValidConnectorType(config.connectorType)) {
            errors.push(`Invalid connector type: ${config.connectorType}`);
        }
        if (!config.config || Object.keys(config.config).length === 0) {
            errors.push('Connector configuration is required');
        }
        const typeSpecificErrors = this.validateTypeSpecificConfig(config);
        errors.push(...typeSpecificErrors);
        if (!config.isEnabled) {
            warnings.push('Connector is disabled');
        }
        if (config.authInfo && config.authInfo.length > 10240) {
            warnings.push('Auth info size exceeds 10KB');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * 验证类型特定配置
     */
    validateTypeSpecificConfig(config) {
        const errors = [];
        switch (config.connectorType) {
            case ConnectorType.HTTP:
                if (!config.config.baseUrl) {
                    errors.push('HTTP connector requires baseUrl');
                }
                break;
            case ConnectorType.DATABASE:
                if (!config.config.type) {
                    errors.push('Database connector requires type');
                }
                if (!config.config.database) {
                    errors.push('Database connector requires database name');
                }
                break;
            case ConnectorType.API:
                if (!config.config.baseUrl) {
                    errors.push('API connector requires baseUrl');
                }
                if (!config.config.authType) {
                    errors.push('API connector requires authType');
                }
                break;
        }
        return errors;
    }
    /**
     * 存储配置（加密敏感信息）
     */
    async storeConfig(config) {
        const validation = this.validateConfig(config);
        if (!validation.isValid) {
            throw new ConfigurationError(`Invalid connector configuration: ${validation.errors.join(', ')}`);
        }
        const sanitizedConfig = await this.sanitizeConfig(config);
        this.configStore.set(config.connectorId, sanitizedConfig);
        if (config.authInfo) {
            const encrypted = await this.encryptAuthInfo(config.authInfo);
            this.encryptedStore.set(config.connectorId, encrypted);
        }
        this.logger.info(0, `Connector config stored: ${config.connectorId}`);
    }
    /**
     * 获取配置（解密敏感信息）
     */
    async getConfig(connectorId) {
        const config = this.configStore.get(connectorId);
        if (!config) {
            return undefined;
        }
        const encrypted = this.encryptedStore.get(connectorId);
        if (encrypted) {
            const decrypted = await this.decryptAuthInfo(encrypted);
            config.authInfo = decrypted;
        }
        return config;
    }
    /**
     * 删除配置
     */
    async deleteConfig(connectorId) {
        this.configStore.delete(connectorId);
        this.encryptedStore.delete(connectorId);
        this.logger.info(0, `Connector config deleted: ${connectorId}`);
    }
    /**
     * 清理敏感信息
     */
    async sanitizeConfig(config) {
        const sanitized = {
            ...config,
            authInfo: undefined
        };
        if (sanitized.config.password) {
            delete sanitized.config.password;
        }
        if (sanitized.config.apiKey) {
            delete sanitized.config.apiKey;
        }
        if (sanitized.config.token) {
            delete sanitized.config.token;
        }
        return sanitized;
    }
    /**
     * 加密认证信息
     */
    async encryptAuthInfo(authInfo) {
        const algorithm = 'aes-256-gcm';
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this.getEncryptionKey();
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, authInfo);
        return {
            encryptedData: this.arrayBufferToBase64(encrypted),
            iv: this.arrayBufferToBase64(iv.buffer),
            authTag: '',
            algorithm,
            createdAt: new Date()
        };
    }
    /**
     * 解密认证信息
     */
    async decryptAuthInfo(encrypted) {
        const key = await this.getEncryptionKey();
        const iv = this.base64ToArrayBuffer(encrypted.iv);
        const encryptedData = this.base64ToArrayBuffer(encrypted.encryptedData);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedData);
        return new Uint8Array(decrypted);
    }
    /**
     * 获取加密密钥
     */
    async getEncryptionKey() {
        const keyData = new Uint8Array(32);
        crypto.getRandomValues(keyData);
        return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }
    /**
     * ArrayBuffer转Base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    /**
     * Base64转ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
    /**
     * 验证Connector类型
     */
    isValidConnectorType(type) {
        return Object.values(ConnectorType).includes(type);
    }
    /**
     * 获取所有配置ID
     */
    getAllConfigIds() {
        return Array.from(this.configStore.keys());
    }
    /**
     * 清理所有配置
     */
    async clearAll() {
        this.configStore.clear();
        this.encryptedStore.clear();
        this.logger.info(0, 'All connector configs cleared');
    }
}
export const connectorConfigManager = ConnectorConfigManager.getInstance();
//# sourceMappingURL=connector-config-manager.js.map