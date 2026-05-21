export declare function getDatabase(): {
    run: (sql: string, ...params: unknown[]) => void;
    exec: (sql: string, ...params: unknown[]) => {
        columns: string[];
        values: (string | number | null)[][];
    }[];
    get: <T>(_sql: string, ..._params: unknown[]) => T | undefined;
    all: <T>(_sql: string, ..._params: unknown[]) => T[];
};
export declare function saveDatabase(): Promise<void>;
export declare function resetDatabase(): void;
//# sourceMappingURL=database.d.ts.map