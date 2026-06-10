export interface InlineChatContext {
    selectedCode: string;
    surroundingFunction: string | null;
    imports: string[];
    filePath: string;
    languageId: string;
}
export declare class InlineChatContextCollector {
    collect(params: {
        selectedCode: string;
        fileContent: string;
        cursorLine: number;
        filePath: string;
        languageId: string;
    }): InlineChatContext;
    private extractImports;
    private findSurroundingFunction;
}
//# sourceMappingURL=context-collector.d.ts.map