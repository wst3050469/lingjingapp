export class Compactor {
    compact(files, usage, config) {
        if (usage.utilizationPercent <= 75) {
            return files;
        }
        const sorted = [...files].sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        const targetTokens = Math.floor(usage.maxTokens * config.targetUtilization / 100);
        let currentTokens = 0;
        const result = [];
        for (const file of sorted) {
            if (currentTokens + file.tokenCount <= targetTokens) {
                result.push(file);
                currentTokens += file.tokenCount;
            }
            else if (file.priority === 'critical') {
                result.push(file);
                currentTokens += file.tokenCount;
            }
        }
        return result;
    }
}
//# sourceMappingURL=compactor.js.map