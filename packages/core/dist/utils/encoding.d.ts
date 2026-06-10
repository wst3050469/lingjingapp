/**
 * Decode a Buffer to string with Windows GBK fallback.
 *
 * On Windows, cmd.exe may output error messages in GBK (code page 936)
 * even after `chcp 65001`. This function detects invalid UTF-8 sequences
 * (U+FFFD replacement characters) and falls back to GBK decoding.
 */
export declare function decodeBuffer(buf: Buffer): string;
/**
 * Decode a string that may contain GBK-encoded bytes misinterpreted as UTF-8.
 * For use with APIs that return strings directly (e.g. exec/execFile with default encoding).
 */
export declare function fixGbkString(str: string): string;
//# sourceMappingURL=encoding.d.ts.map