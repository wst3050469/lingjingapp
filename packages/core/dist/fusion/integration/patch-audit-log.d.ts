/**
 * Audit Log Patch — Batch D (P1)
 *
 * Provides audit logging for cloud-server API endpoints.
 * Each API endpoint should wrap with createAuditMiddleware().
 */
export interface AuditLogEntry {
    id: string;
    userId: string;
    action: string;
    resource: string;
    result: 'success' | 'failure' | 'denied';
    timestamp: number;
    metadata?: Record<string, unknown>;
}
export declare function createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry;
export interface AuditLogFilter {
    userId?: string;
    action?: string;
    resource?: string;
    result?: AuditLogEntry['result'];
    fromTimestamp?: number;
    toTimestamp?: number;
    limit?: number;
}
export declare function queryAuditLogs(filter?: AuditLogFilter): AuditLogEntry[];
export declare function clearAuditLogs(): void;
export declare function getAuditLogCount(): number;
export declare function createAuditMiddleware(): (req: {
    user?: {
        sub?: string;
    };
    path: string;
    method: string;
}, res: {
    statusCode: number;
}, next: () => void) => void;
//# sourceMappingURL=patch-audit-log.d.ts.map