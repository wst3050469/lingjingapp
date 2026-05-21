export interface AuditLogEntry {
    id: string;
    userId: string;
    action: string;
    resource: string;
    result: 'success' | 'failure' | 'denied';
    timestamp: number;
    metadata?: Record<string, unknown>;
}
export interface AuditLogFilter {
    userId?: string;
    action?: string;
    resource?: string;
    result?: string;
    since?: number;
    until?: number;
    limit?: number;
}
export declare function createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry;
export declare function queryAuditLogs(filter?: AuditLogFilter): AuditLogEntry[];
export declare function clearAuditLogs(): void;
export declare function getAuditLogCount(): number;
export declare function createAuditMiddleware(): (req: any, res: any, next: any) => void;
