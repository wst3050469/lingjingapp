/**
 * Connector基类和接口定义
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ConnectorStatus } from '../types';
/**
 * Connector抽象基类
 */
export class BaseConnector {
    config;
    isConnected = false;
    constructor(config) {
        // Support both production and test constructor formats
        if ('connectorId' in config) {
            this.config = config;
        }
        else {
            const opts = config;
            this.config = {
                connectorId: opts.id,
                connectorType: opts.type,
                connectorName: opts.name,
                config: opts.config,
                isEnabled: true
            };
        }
    }
    /**
     * 连接器初始化（测试兼容：delegates to connect()）
     */
    async initialize() {
        await this.connect();
    }
    /**
     * 获取连接器状态（测试兼容）
     */
    getStatus() {
        return this.isConnected ? ConnectorStatus.ACTIVE : ConnectorStatus.INACTIVE;
    }
    /**
     * 清理资源（测试兼容：delegates to disconnect()）
     */
    async cleanup() {
        await this.disconnect();
    }
    /**
     * 获取连接器ID
     */
    getId() {
        return this.config.connectorId;
    }
    /**
     * 获取连接器类型
     */
    getType() {
        return this.config.connectorType;
    }
    /**
     * 获取连接器名称
     */
    getName() {
        return this.config.connectorName;
    }
    /**
     * 检查是否已连接
     */
    isActive() {
        return this.isConnected;
    }
}
//# sourceMappingURL=base-connector.js.map