import { readFileSync, existsSync, statSync } from 'fs';
import { createHash, randomUUID } from 'crypto';
export class SnapshotCreator {
    storageDir;
    constructor(storageDir) {
        this.storageDir = storageDir;
    }
    async createSnapshot(files, description) {
        const checkpointFiles = [];
        for (const filePath of files) {
            if (existsSync(filePath)) {
                const content = readFileSync(filePath, 'utf-8');
                const hash = createHash('sha256').update(content).digest('hex');
                const stats = statSync(filePath);
                checkpointFiles.push({ path: filePath, content, hash, size: stats.size });
            }
        }
        return {
            id: `cp_${randomUUID()}`,
            timestamp: new Date(),
            description,
            files: checkpointFiles,
        };
    }
    async createBeforeEditSnapshot(filePath) {
        return this.createSnapshot([filePath], `Before editing ${filePath}`);
    }
}
//# sourceMappingURL=snapshot-creator.js.map