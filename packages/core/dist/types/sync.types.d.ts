export declare enum DataType {
    SESSION = "session",
    CONVERSATION = "conversation",
    MESSAGE = "message",
    FILE = "file",
    SETTINGS = "settings",
    WORKSPACE = "workspace"
}
export declare enum SyncStatus {
    SYNCED = "synced",
    PENDING = "pending",
    SYNCING = "syncing",
    CONFLICT = "conflict",
    ERROR = "error",
    OFFLINE = "offline"
}
export declare enum OperationType {
    CREATE = "create",
    UPDATE = "update",
    DELETE = "delete"
}
export interface SyncData {
    id: string;
    dataType: DataType;
    operation: OperationType;
    version: number;
    timestamp: number;
    deviceId: string;
    payload: unknown;
    checksum: string;
    status: SyncStatus;
}
export interface SyncDeltaRequest {
    deviceId: string;
    lastSyncTimestamp: number;
    dataTypes?: DataType[];
}
export interface SyncDeltaResponse {
    changes: SyncData[];
    serverTimestamp: number;
    hasMore: boolean;
    nextCursor?: string;
}
export interface SyncProgress {
    total: number;
    completed: number;
    failed: number;
    current?: SyncData;
    speed?: number;
}
export interface SyncConfig {
    enabled: boolean;
    autoSync: boolean;
    syncInterval: number;
    dataTypes: DataType[];
    excludePatterns?: string[];
    maxRetries: number;
    retryDelay: number;
}
export interface SyncStats {
    lastSyncTime: number;
    totalSynced: number;
    totalFailed: number;
    pendingCount: number;
    conflictCount: number;
}
export declare const DEFAULT_SYNC_CONFIG: SyncConfig;
//# sourceMappingURL=sync.types.d.ts.map