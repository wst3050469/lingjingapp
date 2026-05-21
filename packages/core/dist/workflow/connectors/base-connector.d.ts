/**
 * Connector基类和接口定义
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ConnectorType, ConnectorConfig, ConnectorResult, ConnectorStatus } from '../types';
/**
 * 测试兼容的 Connector 构造参数
 */
export interface TestConnectorOptions {
    id: string;
    type: ConnectorType;
    name: string;
    config: Record<string, any>;
}
/**
 * Connector抽象基类
 */
export declare abstract class BaseConnector {
    protected config: ConnectorConfig;
    protected isConnected: boolean;
    constructor(config: ConnectorConfig | TestConnectorOptions);
    /**
     * 连接器初始化（测试兼容：delegates to connect()）
     */
    initialize(): Promise<void>;
    /**
     * 获取连接器状态（测试兼容）
     */
    getStatus(): ConnectorStatus;
    /**
     * 清理资源（测试兼容：delegates to disconnect()）
     */
    cleanup(): Promise<void>;
    /**
     * 连接器初始化
     */
    abstract connect(): Promise<void>;
    /**
     * 连接器断开
     */
    abstract disconnect(): Promise<void>;
    /**
     * 执行操作
     */
    abstract execute(operation: ConnectorOperation): Promise<ConnectorResult>;
    /**
     * 健康检查
     */
    abstract healthCheck(): Promise<boolean>;
    /**
     * 获取连接器ID
     */
    getId(): string;
    /**
     * 获取连接器类型
     */
    getType(): ConnectorType;
    /**
     * 获取连接器名称
     */
    getName(): string;
    /**
     * 检查是否已连接
     */
    isActive(): boolean;
}
/**
 * Connector操作接口
 */
export interface ConnectorOperation {
    operationType: string;
    parameters: Record<string, any>;
    options?: ConnectorOperationOptions;
}
/**
 * Connector操作选项
 */
export interface ConnectorOperationOptions {
    timeout?: number;
    retryCount?: number;
    retryDelay?: number;
}
/**
 * Connector状态快照
 */
export interface ConnectorStateSnapshot {
    connectorId: string;
    connectorName: string;
    connectorType: ConnectorType;
    isConnected: boolean;
    lastHealthCheck?: Date;
    errorCount: number;
    successCount: number;
}
//# sourceMappingURL=base-connector.d.ts.map