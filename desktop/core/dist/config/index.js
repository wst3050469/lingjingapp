// @codepilot/core - Config module
// Reads and writes ~/.lingjing/config.json for LLM/App configuration
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
/**
 * Load the Lingjing configuration from ~/.lingjing/config.json
 * Returns an object with { config, raw } where config is the typed config
 * and raw is the raw JSON object from disk.
 */
export function loadConfig() {
    const configPath = join(homedir(), '.lingjing', 'config.json');
    const raw = {};
    try {
        const data = readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            Object.assign(raw, parsed);
        }
    }
    catch {
        // File doesn't exist or is invalid - return empty config
    }
    return { config: raw, raw };
}
/** Schema stub - referenced by some consumers */
export const AppConfigSchema = {};
/** Default config stub */
export const DEFAULT_CONFIG = {};
//# sourceMappingURL=index.js.map