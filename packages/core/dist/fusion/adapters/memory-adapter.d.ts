import { IMemoryAdapter } from './types.js';
export declare class MemoryAdapter implements IMemoryAdapter {
    readonly version = "1.0.0";
    private store;
    private writeHandler;
    setWriteHandler(handler: (key: string, value: unknown, scope?: string) => Promise<void>): void;
    private getScope;
    write(key: string, value: unknown, scope?: string): Promise<void>;
    read(key: string, scope?: string): Promise<unknown | undefined>;
    delete(key: string, scope?: string): Promise<void>;
    list(scope?: string): Promise<Array<{
        key: string;
        value: unknown;
    }>>;
}
export declare function createMemoryAdapter(): MemoryAdapter;
//# sourceMappingURL=memory-adapter.d.ts.map