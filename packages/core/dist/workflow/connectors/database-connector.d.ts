/**
 * Database Connector - SQL查询执行
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ConnectorConfig, ConnectorResult } from '../types';
import { BaseConnector, ConnectorOperation } from './base-connector';
/**
 * 数据库配置
 */
export interface DatabaseConfig {
    type: 'sqlite' | 'postgres' | 'mysql';
    host?: string;
    port?: number;
    database: string;
    username?: string;
    password?: string;
    poolSize?: number;
}
/**
 * 查询结果
 */
export interface QueryResult {
    rows: any[];
    rowCount: number;
    fields?: string[];
}
/**
 * Database Connector
 */
export declare class DatabaseConnector extends BaseConnector {
    private logger;
    private dbConfig;
    private connection?;
    constructor(config: ConnectorConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    execute(operation: ConnectorOperation | {
        sql: string;
        params?: any[];
    }): Promise<ConnectorResult>;
    healthCheck(): Promise<boolean>;
    private connectSQLite;
    private connectPostgres;
    private connectMySQL;
    private disconnectSQLite;
    private disconnectPool;
    private executeQuery;
    private executeInsert;
    private executeUpdate;
    private executeDelete;
}
//# sourceMappingURL=database-connector.d.ts.map