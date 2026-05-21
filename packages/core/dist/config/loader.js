// Config loader: CLI flags > env vars > config file > defaults
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { AppConfigSchema } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
export { DEFAULT_CONFIG }; // re-export for index.ts compatibility
const CONFIG_DIR = join(homedir(), '.lingjing');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
async function loadConfigFile() {
    try {
        const raw = await readFile(CONFIG_FILE, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
function loadEnvVars() {
    const config = {};
    if (process.env.OPENAI_API_KEY) {
        config.apiKeys = { ...config.apiKeys, openai: process.env.OPENAI_API_KEY };
    }
    if (process.env.ANTHROPIC_API_KEY) {
        config.apiKeys = { ...config.apiKeys, anthropic: process.env.ANTHROPIC_API_KEY };
    }
    if (process.env.CODEPILOT_MODEL) {
        config.model = process.env.CODEPILOT_MODEL;
    }
    if (process.env.OLLAMA_BASE_URL) {
        config.ollama = { baseUrl: process.env.OLLAMA_BASE_URL };
    }
    return config;
}
function loadCliFlags() {
    const { values } = parseArgs({
        options: {
            model: { type: 'string', short: 'm' },
            verbose: { type: 'boolean', short: 'v', default: false },
            'no-tools': { type: 'boolean', default: false },
            'system-prompt': { type: 'string', short: 's' },
        },
        strict: false,
    });
    const config = {};
    if (values.model)
        config.model = values.model;
    if (values['system-prompt'])
        config.systemPrompt = values['system-prompt'];
    return {
        config,
        cliOptions: {
            verbose: values.verbose ?? false,
            noTools: values['no-tools'] ?? false,
        },
    };
}
function deepMerge(...objects) {
    const result = {};
    for (const obj of objects) {
        for (const [key, value] of Object.entries(obj)) {
            if (value === undefined)
                continue;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                result[key] = deepMerge(result[key] ?? {}, value);
            }
            else {
                result[key] = value;
            }
        }
    }
    return result;
}
export async function loadConfig() {
    const fileConfig = await loadConfigFile();
    const envConfig = loadEnvVars();
    const { config: cliConfig, cliOptions } = loadCliFlags();
    // Merge: defaults < file < env < cli
    const merged = deepMerge(DEFAULT_CONFIG, fileConfig, envConfig, cliConfig);
    const config = AppConfigSchema.parse(merged);
    return { config, cliOptions };
}
//# sourceMappingURL=loader.js.map