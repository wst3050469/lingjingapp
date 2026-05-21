import type { MultiFileEditSession, FileEdit, FileDiff, ApplyResult } from './types.js';
export declare class MultiFileEditEngine {
    private diffGenerator;
    private conflictDetector;
    private editApplier;
    private editPlanner;
    constructor();
    generate(instruction: string, contextFiles: string[]): MultiFileEditSession;
    processEdits(edits: FileEdit[], baseHashes: Map<string, string>): FileDiff[];
    acceptFile(session: MultiFileEditSession, filePath: string): MultiFileEditSession;
    rejectFile(session: MultiFileEditSession, filePath: string): MultiFileEditSession;
    acceptBlock(session: MultiFileEditSession, filePath: string, hunkId: string): MultiFileEditSession;
    rejectBlock(session: MultiFileEditSession, filePath: string, hunkId: string): MultiFileEditSession;
    applyAll(session: MultiFileEditSession, contents: Map<string, string>): ApplyResult[];
}
//# sourceMappingURL=multi-file-edit-engine.d.ts.map