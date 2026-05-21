import { ILLMAdapter, LLMProvider, ChatRequest, StreamEvent } from './types.js';
export declare class LLMAdapter implements ILLMAdapter {
    readonly version = "1.0.0";
    private provider;
    setProvider(provider: LLMProvider): void;
    chat(request: ChatRequest): AsyncIterable<StreamEvent>;
    getModel(): string;
    getName(): string;
}
export declare function createLLMAdapter(provider?: LLMProvider): LLMAdapter;
//# sourceMappingURL=llm-adapter.d.ts.map