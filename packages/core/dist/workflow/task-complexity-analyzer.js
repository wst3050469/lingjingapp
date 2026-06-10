/**
 * 任务复杂度分析器
 * 分析用户输入的任务，判断是否需要创建工作流
 */
export class TaskComplexityAnalyzer {
    // 复杂任务关键词
    static COMPLEX_KEYWORDS = {
        development: ['开发', '实现', '构建', '创建系统', '创建应用', '开发功能', '实现功能', '构建系统'],
        integration: ['集成', '对接', '接入', '连接', '整合'],
        refactor: ['重构', '优化架构', '改造', '迁移'],
        feature: ['新增功能', '添加功能', '开发模块', '实现模块'],
    };
    // 简单任务关键词
    static SIMPLE_KEYWORDS = [
        '修改', '更改', '修复', '调整', '更新',
        '查看', '检查', '搜索', '查找', '读取',
        '删除', '移除', '重命名',
        '解释', '说明', '分析这段代码',
    ];
    /**
     * 分析任务复杂度
     */
    static analyze(userMessage) {
        const message = userMessage.toLowerCase();
        // 检查是否是简单任务
        for (const keyword of this.SIMPLE_KEYWORDS) {
            if (message.includes(keyword)) {
                // 进一步检查：如果同时包含复杂关键词，则仍视为复杂任务
                const hasComplexKeyword = Object.values(this.COMPLEX_KEYWORDS)
                    .flat()
                    .some(kw => message.includes(kw));
                if (!hasComplexKeyword) {
                    return {
                        isComplex: false,
                        confidence: 0.8,
                    };
                }
            }
        }
        // 检查复杂任务关键词
        for (const [category, keywords] of Object.entries(this.COMPLEX_KEYWORDS)) {
            for (const keyword of keywords) {
                if (message.includes(keyword)) {
                    // 提取功能名称
                    const featureName = this.extractFeatureName(userMessage, keyword);
                    const description = this.extractDescription(userMessage);
                    return {
                        isComplex: true,
                        featureName,
                        description,
                        category,
                        confidence: 0.9,
                    };
                }
            }
        }
        // 检查任务长度和描述复杂度
        const wordCount = userMessage.split(/\s+/).length;
        const hasMultipleRequirements = (userMessage.match(/[,，、;；]/g) || []).length >= 3;
        const hasSystemKeywords = /系统|应用|平台|架构|模块/.test(userMessage);
        if (wordCount > 50 || hasMultipleRequirements || hasSystemKeywords) {
            return {
                isComplex: true,
                featureName: this.extractFeatureName(userMessage, ''),
                description: userMessage.slice(0, 200),
                category: 'complex',
                confidence: 0.7,
            };
        }
        // 默认：简单任务
        return {
            isComplex: false,
            confidence: 0.6,
        };
    }
    /**
     * 提取功能名称
     */
    static extractFeatureName(message, keyword) {
        // 尝试提取"开发XXX"、"实现XXX"后面的内容
        const patterns = [
            /(?:开发|实现|构建|创建|添加|新增)([^\s,，。；;]{2,20})/,
            /(?:开发|实现|构建|创建|添加|新增)([^\s,，。；;]+功能)/,
            /([^\s,，。；;]{2,20})(?:系统|模块|功能)/,
        ];
        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        // 如果找不到，使用消息的前20个字符
        return message.slice(0, 20).trim();
    }
    /**
     * 提取描述
     */
    static extractDescription(message) {
        // 提取第一句话作为描述
        const sentences = message.split(/[。！？\n]/);
        if (sentences.length > 0 && sentences[0].length > 10) {
            return sentences[0].trim();
        }
        return message.slice(0, 100).trim();
    }
}
//# sourceMappingURL=task-complexity-analyzer.js.map