import { ReviewRuleLoader } from './rule-loader.js';
const DIMENSIONS = ['security', 'performance', 'style', 'best-practice', 'logic-error'];
const SEVERITIES = ['critical', 'warning', 'info', 'suggestion'];
export class ReviewEngine {
    ruleLoader;
    llmProvider;
    constructor(llmProvider) {
        this.ruleLoader = new ReviewRuleLoader();
        this.llmProvider = llmProvider;
    }
    async review(diffContent, filePath, language, projectPath) {
        await this.ruleLoader.loadRules(projectPath);
        const ruleFindings = this.ruleLoader.match(diffContent, filePath, language);
        let llmFindings = [];
        if (this.llmProvider) {
            try {
                llmFindings = await this.reviewWithLLM(diffContent, filePath, language);
            }
            catch (err) {
                console.error('[Review] LLM review failed, falling back to rule-only:', err);
            }
        }
        const allFindings = this.deduplicateFindings([...ruleFindings, ...llmFindings]);
        allFindings.sort((a, b) => {
            const sevOrder = { critical: 0, warning: 1, info: 2, suggestion: 3 };
            return sevOrder[a.severity] - sevOrder[b.severity];
        });
        const reportId = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return {
            id: reportId,
            findings: allFindings,
            summary: this.buildSummary(allFindings),
            reviewedAt: new Date().toISOString(),
            reviewerType: this.llmProvider ? 'hybrid' : 'rule',
        };
    }
    async reviewWithLLM(diffContent, filePath, language) {
        if (!this.llmProvider)
            return [];
        const prompt = `You are a code reviewer. Review the following ${language} code diff from "${filePath}".
Analyze across dimensions: security, performance, style, best-practice, logic-error.
For each issue found, respond in JSON format:
{"findings":[{"dimension":"...","severity":"critical|warning|info|suggestion","line":0,"message":"...","suggestion":"..."}]}

Diff:
\`\`\`diff
${diffContent.slice(0, 8000)}
\`\`\``;
        try {
            const response = await this.llmProvider.chat({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
            });
            const content = typeof response === 'string' ? response : JSON.stringify(response);
            const jsonMatch = content.match(/\{[\s\S]*"findings"[\s\S]*\}/);
            if (!jsonMatch)
                return [];
            const parsed = JSON.parse(jsonMatch[0]);
            return (parsed.findings || []).map((f, i) => ({
                ruleId: `llm_${i}`,
                ruleName: 'AI Review',
                dimension: f.dimension || 'style',
                severity: f.severity || 'info',
                filePath,
                line: f.line || 1,
                message: f.message || '',
                suggestion: f.suggestion,
            }));
        }
        catch {
            return [];
        }
    }
    async reviewLargeDiff(files, projectPath) {
        const sortedFiles = files.sort((a, b) => b.diff.length - a.diff.length);
        const allFindings = [];
        const batchSize = 10;
        for (let i = 0; i < sortedFiles.length; i += batchSize) {
            const batch = sortedFiles.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(f => this.review(f.diff, f.path, f.language, projectPath)));
            for (const report of batchResults) {
                allFindings.push(...report.findings);
            }
        }
        const reportId = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return {
            id: reportId,
            findings: this.deduplicateFindings(allFindings),
            summary: this.buildSummary(allFindings),
            reviewedAt: new Date().toISOString(),
            reviewerType: this.llmProvider ? 'hybrid' : 'rule',
        };
    }
    getRuleLoader() {
        return this.ruleLoader;
    }
    deduplicateFindings(findings) {
        const seen = new Set();
        return findings.filter(f => {
            const key = `${f.ruleId}:${f.filePath}:${f.line}:${f.message}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    buildSummary(findings) {
        const byDimension = {};
        const bySeverity = {};
        for (const d of DIMENSIONS)
            byDimension[d] = 0;
        for (const s of SEVERITIES)
            bySeverity[s] = 0;
        for (const f of findings) {
            byDimension[f.dimension] = (byDimension[f.dimension] || 0) + 1;
            bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
        }
        const sevWeights = { critical: 10, warning: 5, info: 1, suggestion: 0.5 };
        const totalWeight = findings.reduce((sum, f) => sum + sevWeights[f.severity], 0);
        const score = Math.max(0, 100 - totalWeight * 2);
        return { total: findings.length, byDimension, bySeverity, score: Math.round(score * 10) / 10 };
    }
}
//# sourceMappingURL=engine.js.map