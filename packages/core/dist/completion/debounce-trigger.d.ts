export declare class DebounceTrigger {
    private timer;
    private readonly delayMs;
    constructor(delayMs?: number);
    trigger(callback: () => void): void;
    cancel(): void;
    isPending(): boolean;
}
//# sourceMappingURL=debounce-trigger.d.ts.map