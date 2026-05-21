export interface SemanticVersion {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
    raw: string;
}
export declare class VersionParseError extends Error {
    constructor(version: string, message: string);
}
export declare class VersionParser {
    private static readonly VERSION_REGEX;
    static parse(version: string): SemanticVersion;
    static compare(v1: SemanticVersion, v2: SemanticVersion): number;
    static compareVersions(version1: string, version2: string): number;
    static isGreaterThan(version1: string, version2: string): boolean;
    static isLessThan(version1: string, version2: string): boolean;
    static isEqual(version1: string, version2: string): boolean;
    static needsUpgrade(currentVersion: string, latestVersion: string): boolean;
    static format(version: SemanticVersion): string;
    static isValid(version: string): boolean;
    static getNextPatch(version: string): string;
    static getNextMinor(version: string): string;
    static getNextMajor(version: string): string;
}
//# sourceMappingURL=version-parser.d.ts.map