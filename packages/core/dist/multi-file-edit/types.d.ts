export type HunkDecision = 'pending' | 'accepted' | 'rejected';
export type ConflictType = 'content_conflict' | 'delete_conflict' | 'create_conflict';
export interface DiffHunk {
    id: string;
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    content: string;
    decision: HunkDecision;
}
export interface FileDiff {
    filePath: string;
    hunks: DiffHunk[];
    hasConflict: boolean;
    conflictInfo?: ConflictInfo;
}
export interface ConflictInfo {
    type: ConflictType;
    aiBaseHash: string;
    currentHash: string;
    description: string;
}
export interface FileEdit {
    filePath: string;
    originalContent: string;
    modifiedContent: string;
    diff: string;
}
export type MultiFileEditSessionState = 'planning' | 'generating' | 'reviewing' | 'applying' | 'completed' | 'error';
export interface MultiFileEditSession {
    id: string;
    state: MultiFileEditSessionState;
    files: FileDiff[];
    instruction: string;
    createdAt: Date;
}
export interface ApplyResult {
    filePath: string;
    success: boolean;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map