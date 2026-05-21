export class CheckpointCleaner {
    config;
    constructor(config) {
        this.config = {
            maxAge: config?.maxAge ?? 7 * 24 * 60 * 60 * 1000,
            maxCount: config?.maxCount ?? 50,
            autoCreateBeforeAIEdit: config?.autoCreateBeforeAIEdit ?? true,
        };
    }
    async clean(checkpoints) {
        const removedIds = [];
        const now = Date.now();
        const remaining = checkpoints
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .filter(cp => {
            const age = now - new Date(cp.timestamp).getTime();
            if (age > this.config.maxAge) {
                removedIds.push(cp.id);
                return false;
            }
            return true;
        });
        while (remaining.length > this.config.maxCount) {
            const oldest = remaining.pop();
            if (oldest)
                removedIds.push(oldest.id);
        }
        return removedIds;
    }
}
//# sourceMappingURL=checkpoint-cleaner.js.map