export declare class LLMQuotaManager {
    private maxConcurrency;
    private currentCount;
    constructor(maxConcurrency: number);
    acquire(): boolean;
    release(): void;
    get available(): number;
    get used(): number;
}
//# sourceMappingURL=llm-quota-manager.d.ts.map