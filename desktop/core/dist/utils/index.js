// Stub: utils/index module
export const VersionParser = {
  parse(v) {
    const parts = (v || '0.0.0').replace(/^v/, '').split('.');
    return { major: parseInt(parts[0]) || 0, minor: parseInt(parts[1]) || 0, patch: parseInt(parts[2]) || 0 };
  },
  needsUpgrade() { return false; },
  compare() { return 0; },
};
export const SemanticVersion = class {};

// Additional stubs for uncommented exports
export function truncateString(s, maxLen) { return (s && s.length > maxLen) ? s.substring(0, maxLen) + '...' : s; }
export function truncateLines(s, maxLines) {
  if (!s) return '';
  const lines = s.split('\n');
  return lines.length > maxLines ? lines.slice(0, maxLines).join('\n') + '\n...' : s;
}
export function decodeBuffer(buf, encoding) { return buf ? buf.toString(encoding || 'utf8') : ''; }
export function fixGbkString(s) { return s; }
export async function withRetry(fn, opts) {
  const maxRetries = (opts && opts.maxRetries) || 3;
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); } catch (e) { if (i === maxRetries - 1) throw e; }
  }
}
