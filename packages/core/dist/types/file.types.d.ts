export interface FileChunk {
    index: number;
    totalChunks: number;
    data: string;
    checksum: string;
    size: number;
}
export interface FileVersion {
    versionId: string;
    version: number;
    size: number;
    checksum: string;
    uploadedAt: number;
    uploadedBy: string;
    metadata?: Record<string, string>;
}
export interface FileUploadRequest {
    fileId: string;
    filename: string;
    totalSize: number;
    totalChunks: number;
    checksum: string;
    mimeType: string;
    metadata?: Record<string, string>;
}
export interface FileUploadResponse {
    fileId: string;
    uploadUrl: string;
    chunkSize: number;
    uploadedChunks: number[];
    status: 'pending' | 'uploading' | 'completed' | 'failed';
}
export interface FileDownloadRequest {
    fileId: string;
    versionId?: string;
    range?: {
        start: number;
        end: number;
    };
}
export interface FileDownloadResponse {
    fileId: string;
    filename: string;
    size: number;
    mimeType: string;
    checksum: string;
    version: FileVersion;
    downloadUrl: string;
}
export interface FileSyncItem {
    id: string;
    localPath: string;
    remoteFileId?: string;
    size: number;
    checksum: string;
    lastModified: number;
    syncStatus: 'synced' | 'pending' | 'uploading' | 'downloading' | 'conflict';
    lastSyncAt?: number;
    metadata?: Record<string, unknown>;
}
export interface FileSyncConfig {
    enabled: boolean;
    autoSync: boolean;
    maxFileSize: number;
    chunkSize: number;
    maxConcurrentUploads: number;
    maxConcurrentDownloads: number;
    excludePatterns: string[];
    includePatterns: string[];
    deduplicationEnabled: boolean;
}
export declare const DEFAULT_FILE_SYNC_CONFIG: FileSyncConfig;
export declare const MAX_STORAGE_SIZE: number;
export declare const MAX_FILE_SIZE: number;
export declare const CHUNK_SIZE: number;
//# sourceMappingURL=file.types.d.ts.map