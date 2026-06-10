export class FixValidator {
    validate(appliedFixId, newDiagnostics, previousDiagnostics) {
        const newErrors = newDiagnostics.filter(d => d.severity === 'error' && !previousDiagnostics.some(p => p.filePath === d.filePath && p.line === d.line && p.code === d.code));
        if (newErrors.length > 0) {
            return {
                success: false,
                fixId: appliedFixId,
                appliedAt: new Date(),
                newDiagnostics: newErrors,
                error: `修复引入了 ${newErrors.length} 个新错误`,
            };
        }
        return {
            success: true,
            fixId: appliedFixId,
            appliedAt: new Date(),
        };
    }
}
//# sourceMappingURL=fix-validator.js.map