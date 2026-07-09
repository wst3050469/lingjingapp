const SENSITIVE_KEYWORDS = ['password', 'secret', 'token', 'key', 'credential', 'private'];

export function maskApiKey(key: string): string {
  if (key.length <= 12) return '****';
  return `${key.slice(0, 8)}****${key.slice(-4)}`;
}

export function maskEnvVar(name: string, value: string): string {
  const lower = name.toLowerCase();
  if (SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return '****';
  }
  return value;
}