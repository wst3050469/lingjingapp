export const DEFAULT_FILE_SYNC_CONFIG = {
    enabled: true,
    autoSync: true,
    maxFileSize: 100 * 1024 * 1024,
    chunkSize: 5 * 1024 * 1024,
    maxConcurrentUploads: 3,
    maxConcurrentDownloads: 3,
    excludePatterns: ['node_modules/**', '.git/**', '**/*.log'],
    includePatterns: ['**/*'],
    deduplicationEnabled: true
};
export const MAX_STORAGE_SIZE = 10 * 1024 * 1024 * 1024;
export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export const CHUNK_SIZE = 5 * 1024 * 1024;
//# sourceMappingURL=file.types.js.map