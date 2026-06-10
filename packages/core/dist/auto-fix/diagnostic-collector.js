export class DiagnosticCollector {
    diagnostics = [];
    add(diagnostic) {
        this.diagnostics.push(diagnostic);
    }
    addAll(diagnostics) {
        this.diagnostics.push(...diagnostics);
    }
    getByFile(filePath) {
        return this.diagnostics.filter(d => d.filePath === filePath);
    }
    getBySeverity(severity) {
        return this.diagnostics.filter(d => d.severity === severity);
    }
    groupByType() {
        const groups = new Map();
        for (const d of this.diagnostics) {
            const key = `${d.source}:${d.code}`;
            if (!groups.has(key))
                groups.set(key, []);
            groups.get(key).push(d);
        }
        return groups;
    }
    getAll() {
        return [...this.diagnostics];
    }
    clear() {
        this.diagnostics = [];
    }
}
//# sourceMappingURL=diagnostic-collector.js.map