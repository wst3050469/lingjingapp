declare class StubHttpClient {
    on(_event: string, _handler: (...args: unknown[]) => void): void;
    emit(_event: string, ..._args: unknown[]): void;
    removeListener(_event: string, _handler: (...args: unknown[]) => void): void;
    post<T = any>(_url: string, _data?: any, _headers?: Record<string, string>): Promise<T>;
    get<T = any>(_url: string, _headers?: Record<string, string>): Promise<T>;
}
export declare const cloudSyncClient: StubHttpClient;
export declare const githubClient: {
    get: <T = any>(_url: string, _options?: Record<string, any>) => Promise<T>;
    post: <T = any>(_url: string, _data?: any, _options?: Record<string, any>) => Promise<T>;
    put: <T = any>(_url: string, _data?: any, _options?: Record<string, any>) => Promise<T>;
    patch: <T = any>(_url: string, _data?: any, _options?: Record<string, any>) => Promise<T>;
    delete: <T = any>(_url: string, _options?: Record<string, any>) => Promise<T>;
};
export {};
//# sourceMappingURL=http-client.d.ts.map