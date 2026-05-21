export class DiffGenerator {
    generate(edit) {
        const hunks = this.computeHunks(edit.originalContent, edit.modifiedContent);
        return {
            filePath: edit.filePath,
            hunks,
            hasConflict: false,
        };
    }
    computeHunks(original, modified) {
        const oldLines = original.split('\n');
        const newLines = modified.split('\n');
        const hunks = [];
        const lcs = this.longestCommonSubsequence(oldLines, newLines);
        let oldIdx = 0;
        let newIdx = 0;
        let lcsIdx = 0;
        let hunkStart = 1;
        while (oldIdx < oldLines.length || newIdx < newLines.length) {
            if (lcsIdx < lcs.length && oldIdx === lcs[lcsIdx].oldIdx && newIdx === lcs[lcsIdx].newIdx) {
                if (oldIdx > hunkStart - 1 || newIdx > hunkStart - 1) {
                    const content = this.buildHunkContent(oldLines, newLines, hunkStart - 1, oldIdx, hunkStart - 1, newIdx);
                    if (content.length > 0) {
                        hunks.push({
                            id: `hunk_${hunks.length + 1}`,
                            oldStart: hunkStart,
                            oldLines: oldIdx - hunkStart + 1,
                            newStart: hunkStart,
                            newLines: newIdx - hunkStart + 1,
                            content,
                            decision: 'pending',
                        });
                    }
                }
                oldIdx++;
                newIdx++;
                lcsIdx++;
                hunkStart = oldIdx + 1;
            }
            else {
                if (oldIdx < oldLines.length)
                    oldIdx++;
                if (newIdx < newLines.length)
                    newIdx++;
            }
        }
        if (hunks.length === 0 && (oldLines.length !== newLines.length || original !== modified)) {
            hunks.push({
                id: 'hunk_1',
                oldStart: 1,
                oldLines: oldLines.length,
                newStart: 1,
                newLines: newLines.length,
                content: `-${oldLines.join('\n-')}\n+${newLines.join('\n+')}`,
                decision: 'pending',
            });
        }
        return hunks;
    }
    buildHunkContent(oldLines, newLines, oldStart, oldEnd, newStart, newEnd) {
        const lines = [];
        for (let i = oldStart; i < oldEnd && i < oldLines.length; i++) {
            lines.push(`-${oldLines[i]}`);
        }
        for (let i = newStart; i < newEnd && i < newLines.length; i++) {
            lines.push(`+${newLines[i]}`);
        }
        return lines.join('\n');
    }
    longestCommonSubsequence(oldLines, newLines) {
        const result = [];
        const matches = new Map();
        for (let i = 0; i < newLines.length; i++) {
            const line = newLines[i].trim();
            if (!matches.has(line))
                matches.set(line, []);
            matches.get(line).push(i);
        }
        let lastNewIdx = -1;
        for (let oldIdx = 0; oldIdx < oldLines.length; oldIdx++) {
            const line = oldLines[oldIdx].trim();
            const candidates = matches.get(line);
            if (candidates) {
                const nextIdx = candidates.find(ni => ni > lastNewIdx);
                if (nextIdx !== undefined) {
                    result.push({ oldIdx, newIdx: nextIdx });
                    lastNewIdx = nextIdx;
                }
            }
        }
        return result;
    }
}
//# sourceMappingURL=diff-generator.js.map