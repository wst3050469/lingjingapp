/**
 * Connector管理器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ConnectorStatus } from '../types';
import { WorkflowLogger } from '../infrastructure/logger';
/**
 * Connector管理器
 */
export class ConnectorManager {
    connectors = new Map();
    logger;
    static instance;
    /**
     * Connector管理器（支持测试直接 new）
     */
    constructor() {
        this.logger = new WorkflowLogger('connector-manager');
    }
    /**
     * 获取单例实例
     */
    static getInstance() {
        if (!ConnectorManager.instance) {
            ConnectorManager.instance = new ConnectorManager();
        }
        return ConnectorManager.instance;
    }
    /**
     * 注册Connector
     */
    async registerConnector(connector) {
        const connectorId = connector.getId();
        if (this.connectors.has(connectorId)) {
            this.logger.warn(0, `Connector ${connectorId} already registered, replacing`);
        }
        await connector.connect();
        this.connectors.set(connectorId, {
            connector,
            registeredAt: new Date(),
            useCount: 0
        });
        this.logger.info(0, `Connector ${connectorId} registered`, {
            name: connector.getName(),
            type: connector.getType()
        });
    }
    /**
     * 注销Connector
     */
    async unregisterConnector(connectorId) {
        const registration = this.connectors.get(connectorId);
        if (!registration) {
            this.logger.warn(0, `Connector ${connectorId} not found`);
            return;
        }
        await registration.connector.disconnect();
        this.connectors.delete(connectorId);
        this.logger.info(0, `Connector ${connectorId} unregistered`);
    }
    /**
     * 获取Connector
     */
    getConnector(connectorId) {
        const registration = this.connectors.get(connectorId);
        if (registration) {
            registration.lastUsed = new Date();
            registration.useCount++;
        }
        return registration?.connector;
    }
    /**
     * 执行Connector操作
     */
    async executeOperation(connectorId, operation) {
        const connector = this.getConnector(connectorId);
        if (!connector) {
            return {
                success: false,
                error: new Error(`Connector ${connectorId} not found`)
            };
        }
        if (!connector.isActive()) {
            this.logger.warn(0, `Connector ${connectorId} is not active`);
            return {
                success: false,
                error: new Error(`Connector ${connectorId} is not active`)
            };
        }
        try {
            const result = await connector.execute(operation);
            return result;
        }
        catch (error) {
            this.logger.error(0, `Connector ${connectorId} operation failed`, error);
            return {
                success: false,
                error: error
            };
        }
    }
    /**
     * 获取所有Connector状态
     */
    async getAllConnectorStatus() {
        const statuses = [];
        for (const [id, registration] of this.connectors) {
            const healthCheck = await registration.connector.healthCheck();
            statuses.push({
                connectorId: id,
                connectorName: registration.connector.getName(),
                connectorType: registration.connector.getType(),
                isConnected: healthCheck,
                lastHealthCheck: new Date(),
                errorCount: 0,
                successCount: registration.useCount
            });
        }
        return statuses;
    }
    /**
     * 按类型获取Connectors
     */
    getConnectorsByType(type) {
        const connectors = [];
        for (const registration of this.connectors.values()) {
            if (registration.connector.getType() === type) {
                connectors.push(registration.connector);
            }
        }
        return connectors;
    }
    /**
     * 健康检查所有Connectors
     */
    async healthCheckAll() {
        const results = new Map();
        for (const [id, registration] of this.connectors) {
            try {
                const isHealthy = await registration.connector.healthCheck();
                results.set(id, isHealthy);
            }
            catch (error) {
                results.set(id, false);
            }
        }
        return results;
    }
    /**
     * 清理所有Connectors
     */
    async clear() {
        for (const [id] of this.connectors) {
            await this.unregisterConnector(id);
        }
    }
    /**
     * 获取Connector数量
     */
    getConnectorCount() {
        return this.connectors.size;
    }
    // ===== 测试兼容方法 =====
    /**
     * 注册 Connector（测试兼容）
     */
    async register(connector) {
        await this.registerConnector(connector);
    }
    /**
     * 注销 Connector（测试兼容）
     */
    async unregister(connectorId) {
        await this.unregisterConnector(connectorId);
    }
    /**
     * 获取 Connector 状态（测试兼容）
     */
    async getStatus(connectorId) {
        const connector = this.getConnector(connectorId);
        if (!connector)
            return undefined;
        return { status: connector.isActive() ? ConnectorStatus.ACTIVE : ConnectorStatus.INACTIVE };
    }
    /**
     * 列出所有 Connector（测试兼容）
     */
    async list() {
        const connectors = [];
        for (const reg of this.connectors.values()) {
            connectors.push(reg.connector);
        }
        return connectors;
    }
    /**
     * 清理所有 Connector（测试兼容）
     */
    async cleanup() {
        await this.clear();
    }
}
export const connectorManager = ConnectorManager.getInstance();
//# sourceMappingURL=connector-manager.js.map