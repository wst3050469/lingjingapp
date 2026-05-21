import type { SyncData, SyncDeltaResponse, SyncProgress, SyncConfig, DataType, OperationType } from '../types/sync.types.js';
export declare class CloudSyncClient {
    private deviceId;
    private config;
    private offlineQueue;
    private lastSyncTimestamp;
    private syncing;
    private listeners;
    constructor(deviceId: string, config?: Partial<SyncConfig>);
    syncIncremental(): Promise<SyncDeltaResponse>;
    pushData(dataType: DataType, operation: OperationType, payload: unknown): Promise<SyncData>;
    pullData(dataType: DataType, dataId: string): Promise<SyncData | null>;
    private getLocalChanges;
    private applyRemoteChanges;
    private saveLocalChange;
    private markLocalSynced;
    private saveSyncTimestamp;
    private calculateChecksum;
    private rowToSyncData;
    on(event: string, handler: (data: any) => void): void;
    off(event: string, handler: (data: any) => void): void;
    private emit;
    getSyncProgress(): Promise<SyncProgress>;
}
//# sourceMappingURL=cloud-sync-client.d.ts.map