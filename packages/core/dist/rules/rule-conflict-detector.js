export class RuleConflictDetector {
    detectConflicts(rules) {
        const conflicts = [];
        for (let i = 0; i < rules.length; i++) {
            for (let j = i + 1; j < rules.length; j++) {
                const a = rules[i];
                const b = rules[j];
                if (a.name === b.name && a.content !== b.content && a.scope !== b.scope) {
                    conflicts.push({
                        ruleA: a,
                        ruleB: b,
                        description: `规则 "${a.name}" 存在冲突定义`,
                        suggestion: `优先使用${b.scope === 'project' ? '项目级' : '全局'}定义`,
                    });
                }
            }
        }
        return conflicts;
    }
}
//# sourceMappingURL=rule-conflict-detector.js.map