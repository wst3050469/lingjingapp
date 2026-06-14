// Stub: utils/index module (VersionParser)
export const VersionParser = {
  parse(v) {
    const parts = (v || '0.0.0').replace(/^v/, '').split('.');
    return { major: parseInt(parts[0]) || 0, minor: parseInt(parts[1]) || 0, patch: parseInt(parts[2]) || 0 };
  },
  needsUpgrade() { return false; },
  compare() { return 0; },
};
export const SemanticVersion = class {};
