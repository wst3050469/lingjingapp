import { readFile, writeFile } from 'node:fs/promises';
export class SecurityFixIntegration {
    llmProvider;
    constructor(llmProvider) {
        this.llmProvider = llmProvider;
    }
    async generateFix(vulnerability, projectPath) {
        if (!this.llmProvider) {
            return {
                vulnerability,
                fixDescription: vulnerability.suggestion || 'No auto-fix available. Review manually.',
                autoApplicable: false,
            };
        }
        try {
            const fileContent = await readFile(vulnerability.filePath, 'utf-8');
            const lines = fileContent.split('\n');
            const contextStart = Math.max(0, vulnerability.line - 5);
            const contextEnd = Math.min(lines.length, vulnerability.line + 5);
            const context = lines.slice(contextStart, contextEnd).join('\n');
            const prompt = `Fix the following security vulnerability:

Type: ${vulnerability.vulnerabilityType}
Severity: ${vulnerability.severity}
File: ${vulnerability.filePath}:${vulnerability.line}
Message: ${vulnerability.message}

Code context:
\`\`\`
${context}
\`\`\`

Provide the fix as a unified diff format. Only modify the necessary lines.`;
            const response = await this.llmProvider.chat({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
            });
            const content = typeof response === 'string' ? response : JSON.stringify(response);
            const diffMatch = content.match(/```diff\n([\s\S]*?)```/);
            return {
                vulnerability,
                fixDiff: diffMatch ? diffMatch[1] : content,
                fixDescription: `Auto-generated fix for ${vulnerability.vulnerabilityType}`,
                autoApplicable: true,
            };
        }
        catch (err) {
            return {
                vulnerability,
                fixDescription: `Failed to generate fix: ${err}. Manual review recommended.`,
                autoApplicable: false,
            };
        }
    }
    async applyFix(vulnerability, fixDiff) {
        try {
            const content = await readFile(vulnerability.filePath, 'utf-8');
            const lines = content.split('\n');
            const targetLine = vulnerability.line - 1;
            // Simple fix application: replace the vulnerable line with the fix
            const fixLines = fixDiff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.substring(1));
            if (fixLines.length > 0 && targetLine >= 0 && targetLine < lines.length) {
                lines.splice(targetLine, 1, ...fixLines);
                await writeFile(vulnerability.filePath, lines.join('\n'), 'utf-8');
            }
            return { success: true };
        }
        catch (err) {
            return { success: false };
        }
    }
}
//# sourceMappingURL=fix-integration.js.map