export declare enum ConflictType {
    UPDATE_UPDATE = "update_update",
    UPDATE_DELETE = "update_delete",
    DELETE_UPDATE = "delete_update",
    DUPLICATE_CREATE = "duplicate_create",
    VERSION_MISMATCH = "version_mismatch"
}
export declare enum ResolutionStrategy {
    AUTO_MERGE = "auto_merge",
    LOCAL_WIN = "local_win",
    REMOTE_WIN = "remote_win",
    MANUAL = "manual",
    TIMESTAMP = "timestamp"
}
export interface SyncConflict {
    id: string;
    conflictType: ConflictType;
    dataId: string;
    dataType: string;
    localVersion: unknown;
    remoteVersion: unknown;
    localTimestamp: number;
    remoteTimestamp: number;
    deviceId: string;
    createdAt: number;
    resolved: boolean;
    resolution?: ConflictResolution;
}
export interface ConflictResolution {
    strategy: ResolutionStrategy;
    resolvedData?: unknown;
    resolvedBy: string;
    resolvedAt: number;
    notes?: string;
}
export interface ConflictResolutionRequest {
    conflictId: string;
    strategy: ResolutionStrategy;
    customResolution?: unknown;
    notes?: string;
}
export interface ConflictDetectionRule {
    conflictType: ConflictType;
    detectionLogic: (local: unknown, remote: unknown) => boolean;
    autoResolution?: ResolutionStrategy;
}
export interface ConflictStats {
    total: number;
    resolved: number;
    pending: number;
    autoResolved: number;
    manualResolved: number;
}
export interface ConflictMergeRule {
    dataType: string;
    mergeStrategy: 'deep' | 'shallow' | 'custom';
    customMerger?: (local: unknown, remote: unknown) => unknown;
    priority: 'local' | 'remote' | 'merge';
}
//# sourceMappingURL=conflict.types.d.ts.map