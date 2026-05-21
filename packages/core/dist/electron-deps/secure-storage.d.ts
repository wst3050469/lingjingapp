export declare class SecureTokenStorage {
    private _store;
    saveToken(key: string, value: string): Promise<void>;
    loadToken(key: string): Promise<string | null>;
    deleteToken(key: string): Promise<boolean>;
    listKeys(filter?: string): string[];
    getDeviceFingerprint(): Promise<string>;
    destroy(): void;
}
//# sourceMappingURL=secure-storage.d.ts.map