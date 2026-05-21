import { writeFileSync } from 'fs';
export class EditApplier {
    applyFile(diff, originalContent) {
        try {
            const lines = originalContent.split('\n');
            const newLines = [];
            let lineIdx = 0;
            for (const hunk of diff.hunks) {
                if (hunk.decision === 'rejected') {
                    while (lineIdx < hunk.oldStart - 1) {
                        newLines.push(lines[lineIdx++]);
                    }
                    for (let i = 0; i < hunk.oldLines; i++) {
                        if (lineIdx < lines.length)
                            newLines.push(lines[lineIdx++]);
                    }
                    continue;
                }
                while (lineIdx < hunk.oldStart - 1) {
                    newLines.push(lines[lineIdx++]);
                }
                for (let i = 0; i < hunk.oldLines; i++)
                    lineIdx++;
                const addedLines = hunk.content.split('\n').filter(l => l.startsWith('+')).map(l => l.slice(1));
                newLines.push(...addedLines);
            }
            while (lineIdx < lines.length) {
                newLines.push(lines[lineIdx++]);
            }
            writeFileSync(diff.filePath, newLines.join('\n'), 'utf-8');
            return { filePath: diff.filePath, success: true };
        }
        catch (error) {
            return { filePath: diff.filePath, success: false, error: String(error) };
        }
    }
    applyAll(diffs, contents) {
        return diffs.map(diff => {
            const content = contents.get(diff.filePath) ?? '';
            return this.applyFile(diff, content);
        });
    }
}
//# sourceMappingURL=edit-applier.js.map