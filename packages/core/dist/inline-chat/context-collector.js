export class InlineChatContextCollector {
    collect(params) {
        const imports = this.extractImports(params.fileContent);
        const surroundingFunction = this.findSurroundingFunction(params.fileContent, params.cursorLine);
        return {
            selectedCode: params.selectedCode,
            surroundingFunction,
            imports,
            filePath: params.filePath,
            languageId: params.languageId,
        };
    }
    extractImports(content) {
        return content.split('\n').filter(line => /^\s*(import|require|from\s)/.test(line) ||
            /^\s*#include/.test(line) ||
            /^\s*using\s/.test(line)).slice(0, 50);
    }
    findSurroundingFunction(content, cursorLine) {
        const lines = content.split('\n');
        let start = cursorLine - 1;
        let braceCount = 0;
        let foundStart = false;
        for (let i = cursorLine - 1; i >= 0; i--) {
            const line = lines[i];
            if (/\b(function|class|def|async\s+function|const\s+\w+\s*=\s*(async\s+)?\(|=>)\b/.test(line)) {
                start = i;
                foundStart = true;
                break;
            }
        }
        if (!foundStart)
            return null;
        for (let i = start; i < lines.length; i++) {
            for (const ch of lines[i]) {
                if (ch === '{' || ch === '(')
                    braceCount++;
                if (ch === '}' || ch === ')')
                    braceCount--;
            }
            if (braceCount <= 0 && i > start) {
                return lines.slice(start, i + 1).join('\n');
            }
        }
        return null;
    }
}
//# sourceMappingURL=context-collector.js.map