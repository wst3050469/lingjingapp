/**
 * Connector管理器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ConnectorType, ConnectorResult, ConnectorStatus } from '../types';
import { BaseConnector, ConnectorOperation, ConnectorStateSnapshot } from './base-connector';
/**
 * Connector管理器
 */
export declare class ConnectorManager {
    private connectors;
    private logger;
    private static instance?;
    /**
     * Connector管理器（支持测试直接 new）
     */
    constructor();
    /**
     * 获取单例实例
     */
    static getInstance(): ConnectorManager;
    /**
     * 注册Connector
     */
    registerConnector(connector: BaseConnector): Promise<void>;
    /**
     * 注销Connector
     */
    unregisterConnector(connectorId: string): Promise<void>;
    /**
     * 获取Connector
     */
    getConnector(connectorId: string): BaseConnector | undefined;
    /**
     * 执行Connector操作
     */
    executeOperation(connectorId: string, operation: ConnectorOperation): Promise<ConnectorResult>;
    /**
     * 获取所有Connector状态
     */
    getAllConnectorStatus(): Promise<ConnectorStateSnapshot[]>;
    /**
     * 按类型获取Connectors
     */
    getConnectorsByType(type: ConnectorType): BaseConnector[];
    /**
     * 健康检查所有Connectors
     */
    healthCheckAll(): Promise<Map<string, boolean>>;
    /**
     * 清理所有Connectors
     */
    clear(): Promise<void>;
    /**
     * 获取Connector数量
     */
    getConnectorCount(): number;
    /**
     * 注册 Connector（测试兼容）
     */
    register(connector: BaseConnector): Promise<void>;
    /**
     * 注销 Connector（测试兼容）
     */
    unregister(connectorId: string): Promise<void>;
    /**
     * 获取 Connector 状态（测试兼容）
     */
    getStatus(connectorId: string): Promise<{
        status: ConnectorStatus;
    } | undefined>;
    /**
     * 列出所有 Connector（测试兼容）
     */
    list(): Promise<BaseConnector[]>;
    /**
     * 清理所有 Connector（测试兼容）
     */
    cleanup(): Promise<void>;
}
export declare const connectorManager: ConnectorManager;
//# sourceMappingURL=connector-manager.d.ts.map