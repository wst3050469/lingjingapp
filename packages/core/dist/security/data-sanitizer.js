const SENSITIVE_PATTERNS = [
    {
        pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["']?([A-Za-z0-9_\-]{20,})["']?/gi,
        replacement: '[REDACTED_API_KEY]',
        name: 'API Key',
    },
    {
        pattern: /(?:bearer\s+)([A-Za-z0-9_\-\.]{20,})/gi,
        replacement: 'bearer [REDACTED_TOKEN]',
        name: 'Bearer Token',
    },
    {
        pattern: /(?:AKIA[A-Z0-9]{16})/g,
        replacement: '[REDACTED_AWS_KEY]',
        name: 'AWS Access Key',
    },
    {
        pattern: /(?:password|passwd|pwd|secret)\s*[:=]\s*["']?([^\s"']{4,})["']?/gi,
        replacement: '[REDACTED_SECRET]',
        name: 'Password/Secret',
    },
    {
        pattern: /(?:sk-[a-zA-Z0-9]{20,})/g,
        replacement: '[REDACTED_SK_KEY]',
        name: 'SK Key',
    },
];
const TRUNCATE_MAX_LENGTH = 1024;
export class DataSanitizer {
    sanitize(obj) {
        return this.deepTransform(obj, (str) => this.applyPatterns(str));
    }
    sanitizeForLog(obj) {
        return this.deepTransform(obj, (str) => {
            let result = this.applyPatterns(str);
            if (result.length > TRUNCATE_MAX_LENGTH) {
                result = result.substring(0, TRUNCATE_MAX_LENGTH) + '...[TRUNCATED]';
            }
            return result;
        });
    }
    applyPatterns(str) {
        let result = str;
        for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
            result = result.replace(pattern, replacement);
        }
        return result;
    }
    deepTransform(obj, transform) {
        if (typeof obj === 'string') {
            return transform(obj);
        }
        if (Array.isArray(obj)) {
            return obj.map((item) => this.deepTransform(item, transform));
        }
        if (obj !== null && typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.deepTransform(value, transform);
            }
            return result;
        }
        return obj;
    }
}
//# sourceMappingURL=data-sanitizer.js.map