import type { SyncRole, SyncState, SyncConnectionConfig } from './types.js';
import type { OpenSpaceBridge } from './bridge.js';
import type { IEventBus } from '../event-bus/types.js';
export interface IFileSystem {
    readdir(path: string): Promise<string[]>;
    readFile(path: string, encoding: string): Promise<string>;
    writeFile(path: string, data: string, encoding: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string, options?: {
        recursive?: boolean;
    }): Promise<void>;
}
export interface SyncProfile {
    name: string;
    serverAddress: string;
    port: number;
    password?: string;
    defaultRole: SyncRole;
    createdAt: string;
    updatedAt: string;
}
interface SyncStatus {
    state: SyncState;
    role: SyncRole;
    serverAddress: string;
    port: number;
    latency: number;
    clientCount: number;
    error?: string;
}
export declare class OpenSpaceSyncManager {
    private bridge;
    private fs;
    private eventBus;
    private status;
    private profileCache;
    private statusMonitorInterval;
    constructor(fs?: IFileSystem, bridge?: OpenSpaceBridge, eventBus?: IEventBus);
    get currentStatus(): SyncStatus;
    /**
     * Connect to an OpenSpace sync server.
     */
    connect(config: SyncConnectionConfig): Promise<void>;
    /**
     * Disconnect from the sync server.
     */
    disconnect(): Promise<void>;
    /**
     * Change sync role (Host/Client/None).
     */
    setRole(role: SyncRole): Promise<void>;
    /**
     * Get current sync status.
     */
    getStatus(): SyncStatus;
    /**
     * List saved sync profiles.
     */
    listProfiles(): Promise<SyncProfile[]>;
    /**
     * Create a new sync profile.
     */
    createProfile(name: string, config: Omit<SyncProfile, 'name' | 'createdAt' | 'updatedAt'>): Promise<SyncProfile>;
    /**
     * Delete a sync profile.
     */
    deleteProfile(name: string): Promise<void>;
    setBridge(bridge: OpenSpaceBridge): void;
    setFileSystem(fs: IFileSystem): void;
    dispose(): void;
    private startStatusMonitor;
    private stopStatusMonitor;
    private publishEvent;
}
export {};
//# sourceMappingURL=sync-manager.d.ts.map