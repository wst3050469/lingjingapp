export class BatchFixer {
    groupByType(diagnostics) {
        const groups = new Map();
        for (const d of diagnostics) {
            const key = `${d.source}:${d.code}`;
            if (!groups.has(key))
                groups.set(key, []);
            groups.get(key).push(d);
        }
        return Array.from(groups.entries()).map(([type, diags]) => ({ type, diagnostics: diags }));
    }
    applyBatchFix(group, suggestion) {
        return group.diagnostics.map(d => ({
            ...suggestion,
            id: `fix_${d.filePath.replace(/[/\\]/g, '_')}_${d.line}`,
            diagnostic: d,
        }));
    }
}
//# sourceMappingURL=batch-fixer.js.map