import { AuditLogEntry, AuditAction, AuditSeverity, AuditLogFilter, AuditLogStats } from './types.js';
export declare class AuditLogger {
    private logDir;
    private maxFileSize;
    private bufferSize;
    private flushInterval;
    private flushSize;
    constructor(logDir?: string, options?: {
        maxFileSize?: number;
        flushSize?: number;
        flushIntervalMs?: number;
    });
    start(): void;
    stop(): void;
    log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void;
    logAuth(params: {
        action: AuditAction;
        userId: string;
        email: string;
        role: string;
        result: 'success' | 'failure' | 'error';
        ip?: string;
        userAgent?: string;
        errorMessage?: string;
        details?: Record<string, unknown>;
    }): void;
    logDataAccess(params: {
        action: AuditAction;
        userId: string;
        email: string;
        role: string;
        resourceType: string;
        resourceId: string;
        resourceName?: string;
        result: 'success' | 'failure' | 'error';
        details?: Record<string, unknown>;
    }): void;
    logSystemEvent(params: {
        action: AuditAction;
        userId: string;
        email: string;
        role: string;
        severity?: AuditSeverity;
        result: 'success' | 'failure' | 'error';
        details: Record<string, unknown>;
        errorMessage?: string;
    }): void;
    private flush;
    query(filter: AuditLogFilter): Promise<{
        entries: AuditLogEntry[];
        total: number;
    }>;
    getStats(since?: string): Promise<AuditLogStats>;
}
//# sourceMappingURL=AuditLogger.d.ts.map