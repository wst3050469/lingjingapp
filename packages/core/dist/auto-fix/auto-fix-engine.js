import { DiagnosticCollector } from './diagnostic-collector.js';
import { FixGenerator } from './fix-generator.js';
import { BatchFixer } from './batch-fixer.js';
import { FixValidator } from './fix-validator.js';
export class AutoFixEngine {
    diagnosticCollector;
    fixGenerator;
    batchFixer;
    fixValidator;
    constructor() {
        this.diagnosticCollector = new DiagnosticCollector();
        this.fixGenerator = new FixGenerator();
        this.batchFixer = new BatchFixer();
        this.fixValidator = new FixValidator();
    }
    suggest(diagnostic, codeContext) {
        return this.fixGenerator.generateFix(diagnostic, codeContext);
    }
    batchSuggest(diagnostics) {
        const groups = this.batchFixer.groupByType(diagnostics);
        return groups.map(g => ({
            ...g,
            suggestion: g.diagnostics.length > 0 ? this.fixGenerator.generateFix(g.diagnostics[0], '') : undefined,
        }));
    }
    validate(fixId, newDiagnostics, previousDiagnostics) {
        return this.fixValidator.validate(fixId, newDiagnostics, previousDiagnostics);
    }
    addDiagnostics(diagnostics) {
        this.diagnosticCollector.addAll(diagnostics);
    }
    getDiagnosticsByFile(filePath) {
        return this.diagnosticCollector.getByFile(filePath);
    }
}
//# sourceMappingURL=auto-fix-engine.js.map