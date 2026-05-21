import { DiffGenerator } from './diff-generator.js';
import { ConflictDetector } from './conflict-detector.js';
import { EditApplier } from './edit-applier.js';
import { EditPlanner } from './edit-planner.js';
export class MultiFileEditEngine {
    diffGenerator;
    conflictDetector;
    editApplier;
    editPlanner;
    constructor() {
        this.diffGenerator = new DiffGenerator();
        this.conflictDetector = new ConflictDetector();
        this.editApplier = new EditApplier();
        this.editPlanner = new EditPlanner();
    }
    generate(instruction, contextFiles) {
        return this.editPlanner.plan(instruction, contextFiles);
    }
    processEdits(edits, baseHashes) {
        const diffs = edits.map(edit => this.diffGenerator.generate(edit));
        return this.conflictDetector.detectConflicts(diffs, baseHashes);
    }
    acceptFile(session, filePath) {
        return {
            ...session,
            files: session.files.map(f => f.filePath === filePath
                ? { ...f, hunks: f.hunks.map(h => ({ ...h, decision: 'accepted' })) }
                : f),
        };
    }
    rejectFile(session, filePath) {
        return {
            ...session,
            files: session.files.map(f => f.filePath === filePath
                ? { ...f, hunks: f.hunks.map(h => ({ ...h, decision: 'rejected' })) }
                : f),
        };
    }
    acceptBlock(session, filePath, hunkId) {
        return {
            ...session,
            files: session.files.map(f => f.filePath === filePath
                ? { ...f, hunks: f.hunks.map(h => h.id === hunkId ? { ...h, decision: 'accepted' } : h) }
                : f),
        };
    }
    rejectBlock(session, filePath, hunkId) {
        return {
            ...session,
            files: session.files.map(f => f.filePath === filePath
                ? { ...f, hunks: f.hunks.map(h => h.id === hunkId ? { ...h, decision: 'rejected' } : h) }
                : f),
        };
    }
    applyAll(session, contents) {
        return this.editApplier.applyAll(session.files, contents);
    }
}
//# sourceMappingURL=multi-file-edit-engine.js.map