import { writeFileSync, readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
export class RollbackExecutor {
    async rollback(checkpoint, strategy = 'preserve-manual-edits') {
        const restoredFiles = [];
        const conflictFiles = [];
        for (const file of checkpoint.files) {
            if (strategy === 'force') {
                writeFileSync(file.path, file.content, 'utf-8');
                restoredFiles.push(file.path);
            }
            else {
                if (!existsSync(file.path)) {
                    writeFileSync(file.path, file.content, 'utf-8');
                    restoredFiles.push(file.path);
                    continue;
                }
                const currentContent = readFileSync(file.path, 'utf-8');
                const currentHash = createHash('sha256').update(currentContent).digest('hex');
                if (currentHash === file.hash) {
                    writeFileSync(file.path, file.content, 'utf-8');
                    restoredFiles.push(file.path);
                }
                else {
                    conflictFiles.push(file.path);
                }
            }
        }
        return {
            success: conflictFiles.length === 0,
            checkpointId: checkpoint.id,
            restoredFiles,
            conflictFiles,
            message: conflictFiles.length > 0
                ? `Restored ${restoredFiles.length} files, ${conflictFiles.length} files have manual edits`
                : `Successfully restored ${restoredFiles.length} files`,
        };
    }
}
//# sourceMappingURL=rollback-executor.js.map