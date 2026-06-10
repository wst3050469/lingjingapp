import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
export class ConflictDetector {
    detectConflicts(diffs, baseHashes) {
        return diffs.map(diff => {
            const baseHash = baseHashes.get(diff.filePath);
            if (!baseHash)
                return diff;
            const currentHash = this.computeFileHash(diff.filePath);
            if (currentHash && currentHash !== baseHash) {
                return {
                    ...diff,
                    hasConflict: true,
                    conflictInfo: {
                        type: 'content_conflict',
                        aiBaseHash: baseHash,
                        currentHash,
                        description: `File ${diff.filePath} has been modified since the AI generated this edit`,
                    },
                };
            }
            return diff;
        });
    }
    computeFileHash(filePath) {
        try {
            if (existsSync(filePath)) {
                const content = readFileSync(filePath, 'utf-8');
                return createHash('sha256').update(content).digest('hex');
            }
        }
        catch { }
        return null;
    }
}
//# sourceMappingURL=conflict-detector.js.map