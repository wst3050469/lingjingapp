export interface SensitivePattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const DEFAULT_PATTERNS: SensitivePattern[] = [
  { name: 'api_key', pattern: /(?:api[_-]?key|apikey|access[_-]?token)\s*[:=]\s*["']?[^\s"']{8,}/gi, replacement: '[API Key]' },
  { name: 'secret', pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{4,}/gi, replacement: '[Secret]' },
  { name: 'private_key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END/gi, replacement: '[Private Key]' },
  { name: 'ip_address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP]' },
  { name: 'email', pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, replacement: '[Email]' },
  { name: 'credit_card', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[Card]' },
];

export class SensitiveFilter {
  private patterns: SensitivePattern[];

  constructor(customPatterns?: SensitivePattern[]) {
    this.patterns = [...DEFAULT_PATTERNS, ...(customPatterns ?? [])];
  }

  filter(text: string): string {
    let result = text;
    for (const { pattern, replacement } of this.patterns) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  addPattern(pattern: SensitivePattern): void {
    this.patterns.push(pattern);
  }
}
