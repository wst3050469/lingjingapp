// @codepilot/core - Config module
// Reads and writes ~/.lingjing/config.json for LLM/App configuration
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface LingjingConfig {
  model?: string;
  provider?: string;
  apiKeys?: Record<string, string>;
  ollama?: { baseUrl?: string };
  custom?: { name?: string; baseUrl?: string; apiKey?: string };
  temperature?: number;
  maxResponseTokens?: number;
  maxContextTokens?: number;
  systemPrompt?: string;
  conversationDir?: string;
  language?: string;
  quest?: Record<string, any>;
  session?: Record<string, any>;
  rules?: Record<string, any>;
  tools?: { disabled?: string[] };
  notifications?: Record<string, boolean>;
  wiki?: Record<string, any>;
  commands?: any[];
  indexing?: Record<string, any>;
  integrations?: Record<string, any>;
  advanced?: Record<string, any>;
  autoMemory?: boolean;
  maxTurns?: number;
  [key: string]: any;
}

export interface LoadConfigResult {
  config: LingjingConfig;
  raw: Record<string, unknown>;
}

/**
 * Load the Lingjing configuration from ~/.lingjing/config.json
 * Returns an object with { config, raw } where config is the typed config
 * and raw is the raw JSON object from disk.
 */
export function loadConfig(): LoadConfigResult {
  const configPath = join(homedir(), '.lingjing', 'config.json');
  const raw: Record<string, unknown> = {};

  try {
    const data = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.assign(raw, parsed);
    }
  } catch {
    // File doesn't exist or is invalid - return empty config
  }

  return { config: raw as LingjingConfig, raw };
}

/** Schema stub - referenced by some consumers */
export const AppConfigSchema = {};

/** Default config stub */
export const DEFAULT_CONFIG = {};
