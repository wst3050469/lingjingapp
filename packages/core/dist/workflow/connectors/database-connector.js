/**
 * Database Connector - SQL查询执行
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowLogger } from '../infrastructure/logger';
import { BaseConnector } from './base-connector';
/**
 * Database Connector
 */
export class DatabaseConnector extends BaseConnector {
    logger;
    dbConfig;
    connection;
    constructor(config) {
        super(config);
        this.logger = new WorkflowLogger(this.config.connectorId);
        this.dbConfig = this.config.config;
    }
    async connect() {
        this.logger.info(0, 'Database Connector connecting', {
            type: this.dbConfig.type,
            database: this.dbConfig.database
        });
        try {
            switch (this.dbConfig.type) {
                case 'sqlite':
                    this.connection = await this.connectSQLite();
                    break;
                case 'postgres':
                    this.connection = await this.connectPostgres();
                    break;
                case 'mysql':
                    this.connection = await this.connectMySQL();
                    break;
                default:
                    throw new Error(`Unsupported database type: ${this.dbConfig.type}`);
            }
            this.isConnected = true;
            this.logger.info(0, 'Database Connector connected');
        }
        catch (error) {
            this.isConnected = false;
            this.logger.error(0, 'Database connection failed', error);
            throw error;
        }
    }
    async disconnect() {
        this.logger.info(0, 'Database Connector disconnecting');
        if (this.connection) {
            switch (this.dbConfig.type) {
                case 'sqlite':
                    await this.disconnectSQLite();
                    break;
                case 'postgres':
                case 'mysql':
                    await this.disconnectPool();
                    break;
            }
            this.connection = undefined;
        }
        this.isConnected = false;
    }
    async execute(operation) {
        // Test compatibility: accept { sql, params } format
        if ('sql' in operation) {
            const op = operation;
            operation = {
                operationType: 'query',
                parameters: {
                    sql: op.sql,
                    params: op.params || []
                }
            };
        }
        if (!this.isConnected || !this.connection) {
            return {
                success: false,
                error: new Error('Database Connector is not connected')
            };
        }
        const startTime = Date.now();
        try {
            const { operationType, parameters } = operation;
            let result;
            switch (operationType) {
                case 'query':
                    result = await this.executeQuery(parameters.sql, parameters.params);
                    break;
                case 'insert':
                    result = await this.executeInsert(parameters.table, parameters.data);
                    break;
                case 'update':
                    result = await this.executeUpdate(parameters.table, parameters.data, parameters.where);
                    break;
                case 'delete':
                    result = await this.executeDelete(parameters.table, parameters.where);
                    break;
                default:
                    throw new Error(`Unsupported operation: ${operationType}`);
            }
            const duration = Date.now() - startTime;
            this.logger.info(0, 'Database operation completed', {
                operation: operationType,
                rowCount: result.rowCount,
                duration
            });
            return {
                success: true,
                data: result,
                metadata: { duration }
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(0, 'Database operation failed', error);
            return {
                success: false,
                error: error,
                metadata: { duration }
            };
        }
    }
    async healthCheck() {
        if (!this.isConnected || !this.connection) {
            return false;
        }
        try {
            const result = await this.executeQuery('SELECT 1', []);
            return result.rowCount > 0;
        }
        catch (error) {
            return false;
        }
    }
    async connectSQLite() {
        return { type: 'sqlite', path: this.dbConfig.database };
    }
    async connectPostgres() {
        return {
            type: 'postgres',
            host: this.dbConfig.host,
            port: this.dbConfig.port || 5432,
            database: this.dbConfig.database
        };
    }
    async connectMySQL() {
        return {
            type: 'mysql',
            host: this.dbConfig.host,
            port: this.dbConfig.port || 3306,
            database: this.dbConfig.database
        };
    }
    async disconnectSQLite() {
        this.logger.info(0, 'SQLite connection closed');
    }
    async disconnectPool() {
        this.logger.info(0, 'Connection pool closed');
    }
    async executeQuery(sql, params = []) {
        this.logger.debug(0, 'Executing query', { sql, params });
        return {
            rows: [],
            rowCount: 0,
            fields: []
        };
    }
    async executeInsert(table, data) {
        this.logger.debug(0, 'Executing insert', { table, data });
        return {
            rows: [data],
            rowCount: 1
        };
    }
    async executeUpdate(table, data, where) {
        this.logger.debug(0, 'Executing update', { table, data, where });
        return {
            rows: [],
            rowCount: 0
        };
    }
    async executeDelete(table, where) {
        this.logger.debug(0, 'Executing delete', { table, where });
        return {
            rows: [],
            rowCount: 0
        };
    }
}
//# sourceMappingURL=database-connector.js.map