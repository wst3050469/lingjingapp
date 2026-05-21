export class SafetyChecker {
    patterns = [
        { pattern: /rm\s+-rf\s+\//, description: '递归删除根目录', riskLevel: 'dangerous' },
        { pattern: /rm\s+-rf\s+~/, description: '递归删除用户目录', riskLevel: 'dangerous' },
        { pattern: /format\s+[A-Z]:/i, description: '格式化磁盘', riskLevel: 'dangerous' },
        { pattern: /dd\s+if=/, description: '磁盘写入操作', riskLevel: 'dangerous' },
        { pattern: /:\(\)\{.*\}/, description: 'Fork炸弹', riskLevel: 'dangerous' },
        { pattern: /chmod\s+-R\s+777/, description: '递归修改全部权限', riskLevel: 'caution' },
        { pattern: /npm\s+publish/, description: '发布到npm仓库', riskLevel: 'caution' },
        { pattern: /git\s+push\s+--force/, description: '强制推送', riskLevel: 'caution' },
    ];
    check(command) {
        for (const pattern of this.patterns) {
            if (pattern.pattern.test(command)) {
                return { isDangerous: true, riskLevel: pattern.riskLevel, description: pattern.description };
            }
        }
        return { isDangerous: false, riskLevel: 'safe' };
    }
}
//# sourceMappingURL=safety-checker.js.map