// Utils — minimal stub for type checking

export class VersionParser {
  static parse(_v: string) { return { major: 0, minor: 0, patch: 0 }; }
  static compare(_a: string, _b: string) { return 0; }
  static needsUpgrade(_current: string, _latest: string) { return false; }
  static compareVersions(_a: string, _b: string) { return 0; }
}

export class VersionParseError extends Error {}

export class SemanticVersion {
  major = 0;
  minor = 0;
  patch = 0;
}

export {};
