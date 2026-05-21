export interface Checkpoint {
    id: string;
    timestamp: Date;
    description: string;
    files: CheckpointFile[];
    metadata?: Record<string, unknown>;
}
export interface CheckpointFile {
    path: string;
    content: string;
    hash: string;
    size: number;
}
export interface CheckpointInfo {
    id: string;
    timestamp: Date;
    description: string;
    fileCount: number;
    totalSize: number;
}
export type RollbackStrategy = 'force' | 'preserve-manual-edits';
export interface RollbackResult {
    success: boolean;
    checkpointId: string;
    restoredFiles: string[];
    conflictFiles: string[];
    message: string;
}
export interface CheckpointConfig {
    maxAge: number;
    maxCount: number;
    autoCreateBeforeAIEdit: boolean;
}
export interface CheckpointRecord {
    id: string;
    timestamp: string;
    description: string;
    fileCount: number;
    totalSize: number;
    metadata?: string;
}
export interface CheckpointFileRecord {
    checkpointId: string;
    filePath: string;
    hash: string;
    size: number;
}
//# sourceMappingURL=types.d.ts.map