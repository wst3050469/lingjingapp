import { ErrorCode, ErrorCategory } from './types.js';
export interface StructuredErrorOptions {
    errorCode?: ErrorCode;
    errorCategory?: ErrorCategory;
    rootCause?: Error;
    suggestions?: string[];
    recoverable?: boolean;
    context?: Record<string, unknown>;
}
export declare class StructuredError extends Error {
    readonly errorCode: ErrorCode;
    readonly errorCategory: ErrorCategory;
    readonly rootCause?: Error;
    readonly suggestions: string[];
    readonly recoverable: boolean;
    readonly context?: Record<string, unknown>;
    readonly timestamp: number;
    constructor(message: string, options?: StructuredErrorOptions);
    static from(error: unknown, overrides?: StructuredErrorOptions): StructuredError;
    toToolResult(): {
        content: string;
        isError: true;
        metadata?: Record<string, unknown>;
    };
    toJSON(): Record<string, unknown>;
}
//# sourceMappingURL=structured-error.d.ts.map