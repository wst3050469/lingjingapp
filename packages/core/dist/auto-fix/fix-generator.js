import { randomUUID } from 'crypto';
export class FixGenerator {
    generateFix(diagnostic, codeContext) {
        return {
            id: `fix_${randomUUID().slice(0, 8)}`,
            diagnostic,
            fixDescription: this.describeFix(diagnostic),
            fixDiff: '',
            status: 'suggested',
            confidence: this.estimateConfidence(diagnostic),
        };
    }
    generateBatchFixes(diagnostics) {
        return diagnostics.map(d => this.generateFix(d, ''));
    }
    describeFix(diagnostic) {
        const descriptions = {
            'TS2305': '添加缺失的模块导入',
            'TS2322': '修正类型不匹配',
            'TS6133': '移除未使用的声明',
        };
        return descriptions[diagnostic.code] ?? `修复: ${diagnostic.message}`;
    }
    estimateConfidence(diagnostic) {
        const highConfidenceCodes = ['TS6133', 'TS2305', 'TS2307'];
        if (highConfidenceCodes.includes(diagnostic.code))
            return 0.9;
        if (diagnostic.severity === 'error')
            return 0.7;
        return 0.5;
    }
}
//# sourceMappingURL=fix-generator.js.map