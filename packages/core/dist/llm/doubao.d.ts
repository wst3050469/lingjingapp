import type { LLMProvider, ChatRequest, StreamEvent } from './types.js';
export declare class DoubaoProvider implements LLMProvider {
    readonly name = "doubao";
    readonly model: string;
    private readonly apiKey;
    private readonly baseUrl;
    constructor(options: {
        model: string;
        apiKey: string;
        baseUrl?: string;
    });
    chat(request: ChatRequest): AsyncIterable<StreamEvent>;
    private convertMessages;
    private convertUserContent;
    private convertTools;
}
//# sourceMappingURL=doubao.d.ts.map