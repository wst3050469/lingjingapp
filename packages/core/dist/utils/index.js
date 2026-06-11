// Utils — minimal stub for type checking
export class VersionParser {
    static parse(_v) { return { major: 0, minor: 0, patch: 0 }; }
    static compare(_a, _b) { return 0; }
    static needsUpgrade(_current, _latest) { return false; }
    static compareVersions(_a, _b) { return 0; }
}
export class VersionParseError extends Error {
}
export class SemanticVersion {
    major = 0;
    minor = 0;
    patch = 0;
}
//# sourceMappingURL=index.js.map