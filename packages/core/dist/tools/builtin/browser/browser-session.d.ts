export type BrowserOperationName = 'navigate' | 'click' | 'type' | 'select' | 'scroll' | 'screenshot' | 'extractText' | 'extractLinks' | 'extractTable' | 'goBack' | 'goForward' | 'pressKey' | 'wait' | 'getPageInfo' | 'close';
export interface BrowserExecutor {
    (operation: BrowserOperationName, params: Record<string, unknown>, signal?: AbortSignal): Promise<BrowserExecutionResult>;
}
export interface BrowserExecutionResult {
    success: boolean;
    data?: unknown;
    screenshot?: string;
    error?: string;
}
export declare function initBrowserTools(executor: BrowserExecutor): void;
export declare function getBrowserExecutor(): BrowserExecutor | null;
export declare function isBrowserInitialized(): boolean;
//# sourceMappingURL=browser-session.d.ts.map