import type { FileEdit, MultiFileEditSession } from './types.js';
export declare class EditPlanner {
    plan(instruction: string, contextFiles: string[]): MultiFileEditSession;
    setGenerating(session: MultiFileEditSession): MultiFileEditSession;
    setReviewing(session: MultiFileEditSession, edits: FileEdit[]): MultiFileEditSession;
}
//# sourceMappingURL=edit-planner.d.ts.map