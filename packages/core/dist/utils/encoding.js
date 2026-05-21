/**
 * Decode a Buffer to string with Windows GBK fallback.
 *
 * On Windows, cmd.exe may output error messages in GBK (code page 936)
 * even after `chcp 65001`. This function detects invalid UTF-8 sequences
 * (U+FFFD replacement characters) and falls back to GBK decoding.
 */
export function decodeBuffer(buf) {
    const utf8 = buf.toString('utf8');
    if (process.platform !== 'win32' || buf.length === 0) {
        return utf8;
    }
    if (utf8.includes('\ufffd')) {
        try {
            return new TextDecoder('gbk').decode(buf);
        }
        catch {
            return utf8;
        }
    }
    return utf8;
}
/**
 * Decode a string that may contain GBK-encoded bytes misinterpreted as UTF-8.
 * For use with APIs that return strings directly (e.g. exec/execFile with default encoding).
 */
export function fixGbkString(str) {
    if (process.platform !== 'win32' || !str.includes('\ufffd')) {
        return str;
    }
    try {
        // Re-encode as latin1 (binary) then decode as GBK
        const buf = Buffer.from(str, 'latin1');
        return new TextDecoder('gbk').decode(buf);
    }
    catch {
        return str;
    }
}
//# sourceMappingURL=encoding.js.map