export class RuleMerger {
    merge(globalRules, projectRules) {
        const enhanced = [];
        const conflicts = [];
        for (const rule of globalRules) {
            enhanced.push({ ...rule, sourceFile: 'lingjingrules', priority: 0, scope: 'global' });
        }
        for (const rule of projectRules) {
            const enhancedRule = { ...rule, sourceFile: 'lingjingrules', priority: 1, scope: 'project' };
            enhanced.push(enhancedRule);
            const globalMatch = enhanced.find(e => e.scope === 'global' && e.name === rule.name);
            if (globalMatch && globalMatch.content !== rule.content) {
                conflicts.push({
                    ruleA: globalMatch,
                    ruleB: enhancedRule,
                    description: `规则 "${rule.name}" 在全局和项目级别存在不同定义`,
                    suggestion: '项目级规则优先级更高，将使用项目级定义',
                });
            }
        }
        return { rules: enhanced, conflicts, source: ['lingjingrules'] };
    }
}
//# sourceMappingURL=rule-merger.js.map