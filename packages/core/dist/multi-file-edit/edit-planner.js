export class EditPlanner {
    plan(instruction, contextFiles) {
        return {
            id: `mfe_${Date.now()}`,
            state: 'planning',
            files: [],
            instruction,
            createdAt: new Date(),
        };
    }
    setGenerating(session) {
        return { ...session, state: 'generating' };
    }
    setReviewing(session, edits) {
        return { ...session, state: 'reviewing', files: edits.map(() => ({
                filePath: '',
                hunks: [],
                hasConflict: false,
            })) };
    }
}
//# sourceMappingURL=edit-planner.js.map