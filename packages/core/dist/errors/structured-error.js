import { ErrorCode, ERROR_CODE_CATEGORY_MAP } from './types.js';
import { inferErrorCode, inferSuggestions, inferRecoverability } from './infer.js';
export class StructuredError extends Error {
    errorCode;
    errorCategory;
    rootCause;
    suggestions;
    recoverable;
    context;
    timestamp;
    constructor(message, options = {}) {
        super(message);
        this.name = 'StructuredError';
        this.errorCode = options.errorCode ?? ErrorCode.UNKNOWN;
        this.errorCategory = options.errorCategory ?? ERROR_CODE_CATEGORY_MAP[this.errorCode];
        this.rootCause = options.rootCause;
        this.suggestions = options.suggestions ?? [];
        this.recoverable = options.recoverable ?? true;
        this.context = options.context;
        this.timestamp = Date.now();
        Object.setPrototypeOf(this, StructuredError.prototype);
    }
    static from(error, overrides) {
        if (error instanceof StructuredError) {
            return new StructuredError(error.message, {
                errorCode: overrides?.errorCode ?? error.errorCode,
                errorCategory: overrides?.errorCategory ?? error.errorCategory,
                rootCause: overrides?.rootCause ?? error.rootCause,
                suggestions: overrides?.suggestions ?? error.suggestions,
                recoverable: overrides?.recoverable ?? error.recoverable,
                context: overrides?.context ?? error.context,
            });
        }
        const err = error instanceof Error ? error : new Error(String(error));
        const code = overrides?.errorCode ?? inferErrorCode(err);
        const category = overrides?.errorCategory ?? ERROR_CODE_CATEGORY_MAP[code];
        const suggestions = overrides?.suggestions ?? inferSuggestions(err);
        const recoverable = overrides?.recoverable ?? inferRecoverability(err);
        return new StructuredError(err.message, {
            errorCode: code,
            errorCategory: category,
            rootCause: overrides?.rootCause ?? (err !== error ? undefined : undefined),
            suggestions,
            recoverable,
            context: overrides?.context,
        });
    }
    toToolResult() {
        return {
            content: this.message,
            isError: true,
            metadata: {
                errorCode: this.errorCode,
                errorCategory: this.errorCategory,
                recoverable: this.recoverable,
                suggestions: this.suggestions,
                timestamp: this.timestamp,
            },
        };
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            errorCode: this.errorCode,
            errorCategory: this.errorCategory,
            suggestions: this.suggestions,
            recoverable: this.recoverable,
            context: this.context,
            timestamp: this.timestamp,
            rootCause: this.rootCause
                ? { name: this.rootCause.name, message: this.rootCause.message }
                : undefined,
        };
    }
}
//# sourceMappingURL=structured-error.js.map