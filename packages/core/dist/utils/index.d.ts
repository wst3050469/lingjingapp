export declare class VersionParser {
    static parse(_v: string): {
        major: number;
        minor: number;
        patch: number;
    };
    static compare(_a: string, _b: string): number;
    static needsUpgrade(_current: string, _latest: string): boolean;
    static compareVersions(_a: string, _b: string): number;
}
export declare class VersionParseError extends Error {
}
export declare class SemanticVersion {
    major: number;
    minor: number;
    patch: number;
}
export {};
//# sourceMappingURL=index.d.ts.map