// Agent Prompts - load and manage system prompt files
// Prompt .md files are bundled via electron-builder extraResources

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── In-memory prompt cache ──
const _promptCache = new Map<string, string>();
let _loaded = false;

/**
 * Default main system prompt used when no custom system prompt is configured.
 */
export const MAIN_PROMPT = `你是灵境AI（LingJing AI），一个高性能的自主开发智能体。
你的核心能力是：
1. 理解用户需求并生成可执行的代码
2. 自主规划任务步骤并执行
3. 问题诊断与自动修复
4. 代码审查与优化建议

请始终用中文回复，除非用户明确要求使用其他语言。`;

/**
 * Resolve the prompts directory path.
 * Checks multiple locations:
 * 1. process.resourcesPath + '/prompts/' (packaged Electron app)
 * 2. Relative to this file (development)
 */
function resolvePromptsDir(): string | null {
  // Packaged Electron app
  try {
    const resourcesPath = (process as any).resourcesPath;
    if (resourcesPath) {
      const p = join(resourcesPath, 'prompts');
      if (existsSync(p)) return p;
    }
  } catch {}
  
  // Development: relative to core dist
  try {
    const p = resolve(__dirname, '..', '..', '..', '..', 'electron', 'prompts');
    if (existsSync(p)) return p;
  } catch {}
  
  // Fallback: relative to cwd
  try {
    const p = resolve(process.cwd(), 'prompts');
    if (existsSync(p)) return p;
  } catch {}
  
  return null;
}

/**
 * Load all prompt .md files from the prompts directory.
 * Must be called once before getPrompt().
 */
export async function loadPrompts(): Promise<void> {
  if (_loaded) return;
  
  const dir = resolvePromptsDir();
  if (!dir) {
    console.warn('[Prompts] No prompts directory found, using defaults');
    _loaded = true;
    return;
  }
  
  try {
    const files = readdirSync(dir, { withFileTypes: true });
    let count = 0;
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.md')) {
        const content = readFileSync(join(dir, file.name), 'utf-8');
        _promptCache.set(file.name, content);
        count++;
      }
    }
    console.log(`[Prompts] Loaded ${count} prompt files from ${dir}`);
  } catch (err) {
    console.warn(`[Prompts] Failed to load prompts: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  _loaded = true;
}

/**
 * Get a loaded prompt by filename (e.g. "research-expert.md").
 * Returns undefined if the prompt was not loaded.
 */
export function getPrompt(name: string): string | undefined {
  // Try exact match first
  if (_promptCache.has(name)) return _promptCache.get(name);
  
  // Try adding .md extension
  if (!name.endsWith('.md')) {
    const withExt = name + '.md';
    if (_promptCache.has(withExt)) return _promptCache.get(withExt);
  }
  
  // Try without .md extension
  if (name.endsWith('.md')) {
    const withoutExt = name.slice(0, -3);
    if (_promptCache.has(withoutExt)) return _promptCache.get(withoutExt);
  }
  
  return undefined;
}

/**
 * Clear the prompt cache (useful for hot-reload or testing).
 */
export function clearPromptCache(): void {
  _promptCache.clear();
  _loaded = false;
}
