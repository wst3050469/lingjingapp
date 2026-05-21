import { ErrorCode, ErrorCategory } from './types.js';
export declare function inferErrorCode(error: unknown): ErrorCode;
export declare function inferErrorCategory(error: unknown): ErrorCategory;
export declare function inferSuggestions(error: unknown): string[];
export declare function inferRecoverability(error: unknown): boolean;
//# sourceMappingURL=infer.d.ts.map