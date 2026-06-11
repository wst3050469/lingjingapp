declare class StubHttpClient {
    on(_event: string, _handler: (...args: any[]) => void): void;
    emit(_event: string, ..._args: any[]): void;
    removeListener(_event: string, _handler: (...args: any[]) => void): void;
    post(_url: string, _data?: any, _headers?: Record<string, string>): Promise<any>;
    get(_url: string, _headers?: Record<string, string>): Promise<any>;
}
export declare const cloudSyncClient: StubHttpClient;
export declare const githubClient: {
    get: (_url: string, _options?: any) => Promise<any>;
    post: (_url: string, _data?: any, _options?: any) => Promise<any>;
    put: (_url: string, _data?: any, _options?: any) => Promise<any>;
    patch: (_url: string, _data?: any, _options?: any) => Promise<any>;
    delete: (_url: string, _options?: any) => Promise<any>;
};
export {};
//# sourceMappingURL=http-client.d.ts.map