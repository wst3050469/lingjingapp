// @ts-nocheck - Suppress TS errors from @codepilot/core type mismatches; esbuild ignores types
// Wiki Service - core logic for generating and maintaining project documentation

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadConfig, createProvider, gitRevParseHead, gitDiffNameOnly, isGitRepo } from '@codepilot/core';
import type { LLMProvider, AppConfig } from '@codepilot/core';
import {
  buildModulePrompt,
  buildOverviewPrompt,
  buildUpdatePrompt,
  type FileInfo,
  type ModuleSummary,
} from './wiki-prompts.js';

// --- Types ---

export interface WikiManifest {
  version: number;
  baseCommit: string;
  generatedAt: string;
  language: 'en' | 'zh';
  modules: WikiModuleEntry[];
}

export interface WikiModuleEntry {
  path: string;
  title: string;
  contentFile: string;
  sourceHash: string;
  contentHash: string;
  fileCount: number;
  generatedAt: string;
}

export interface ModuleInfo {
  path: string;
  files: string[];
}

export interface WikiProgress {
  phase: 'scanning' | 'generating' | 'overview' | 'updating' | 'done';
  current: number;
  total: number;
  modulePath?: string;
  error?: string;
}

export interface WikiStatus {
  hasWiki: boolean;
  language: string;
  moduleCount: number;
  baseCommit: string;
  generatedAt: string;
}

export interface ChangeDetectionResult {
  changedModules: string[];
  baseCommit: string;
  currentCommit: string;
}

// --- Constants ---

const WIKI_DIR = '.qoder/repowiki';
const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.next', '.nuxt', 'dist', 'build',
  '__pycache__', '.cache', '.lingjing', '.qoder', '.vscode',
  '.idea', 'coverage', '.nyc_output', 'vendor', 'target',
]);
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift',
  '.kt', '.scala', '.vue', '.svelte', '.astro', '.md', '.json',
  '.yaml', '.yml', '.toml', '.sql', '.sh', '.bash', '.zsh',
  '.css', '.scss', '.less', '.html',
]);
const MAX_FILE_SIZE = 100 * 1024; // 100KB per file
const MAX_TOTAL_FILES = 10000;

// --- Wiki Service Class ---

export class WikiService {
  private abortController: AbortController | null = null;

  abort(): void {
    this.abortController?.abort();
  }

  // --- Generation ---

  async generate(
    workspace: string,
    onProgress: (p: WikiProgress) => void
  ): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const loaded = await loadConfig();
    const config = loaded.config;
    const lang = config.wiki.language as 'en' | 'zh';
    const provider = this.createWikiProvider(config);

    // Phase 1: Scan modules
    onProgress?.({ phase: 'scanning', current: 0, total: 0 });
    const modules = await this.scanModules(workspace, config.wiki.ignorePaths);
    if (signal.aborted) return;

    if (modules.length === 0) {
      onProgress?.({ phase: 'done', current: 0, total: 0, error: lang === 'zh' ? '未找到可分析的代码模块' : 'No analyzable code modules found' });
      return;
    }

    // Phase 2: Generate per-module docs (with concurrency + cache)
    const manifestModules: WikiModuleEntry[] = [];
    const moduleSummaries: ModuleSummary[] = [];
    const WIKI_CONCURRENCY = config.wiki.concurrency ?? 3; // max concurrent LLM calls

    // Load existing manifest for cache lookup
    const existingManifest = await this.loadManifest(workspace, lang);
    const existingByPath = new Map<string, WikiModuleEntry>();
    if (existingManifest) {
      for (const entry of existingManifest.modules) {
        existingByPath.set(entry.path, entry);
      }
    }

    // Shared state for concurrent workers
    const moduleResults: Array<{ entry: WikiModuleEntry; summary: ModuleSummary } | null> = [];
    let completedModules = 0;
    let cachedModules = 0;

    /**
     * Process a single module: read files, check cache, call LLM if needed, write content.
     * Pushes result to moduleResults array when done.
     */
    const processModule = async (mod: ModuleInfo, index: number): Promise<void> => {
      if (signal.aborted) return;

      const files = await this.readModuleFiles(workspace, mod, config.wiki.maxFilesPerModule);
      if (signal.aborted) return;

      // Compute source hash from file contents
      const sourceHash = files.length > 0 ? this.hashContent(files.map((f) => f.content).join('')) : '';

      // Check cache: existing entry with same sourceHash → skip LLM call
      const cached = existingByPath.get(mod.path);
      if (cached && cached.sourceHash === sourceHash && files.length > 0) {
        // Cache hit! Reuse existing entry without calling LLM
        moduleResults[index] = {
          entry: cached,
          summary: { path: mod.path, title: cached.title, fileCount: cached.fileCount },
        };
        cachedModules++;
        return;
      }

      if (files.length === 0) return;

      // Cache miss: call LLM to generate content
      const content = await this.callLLM(provider, buildModulePrompt(mod.path, files, lang), signal);
      if (signal.aborted) return;

      const contentFile = mod.path.replace(/[\\/]/g, '-') + '.md';
      const contentHash = this.hashContent(content);

      // Extract title from first heading
      const titleMatch = content.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : mod.path;

      await this.writeContentFile(workspace, lang, contentFile, content);

      moduleResults[index] = {
        entry: {
          path: mod.path,
          title,
          contentFile,
          sourceHash,
          contentHash,
          fileCount: files.length,
          generatedAt: new Date().toISOString(),
        },
        summary: { path: mod.path, title, fileCount: files.length },
      };
    };

    // Concurrent pool for modules
    let moduleIndex = 0;

    const moduleWorker = async (): Promise<void> => {
      while (!signal.aborted) {
        const idx = moduleIndex++;
        if (idx >= modules.length) return;

        onProgress?.({ phase: 'generating', current: idx + 1, total: modules.length, modulePath: modules[idx].path });
        await processModule(modules[idx], idx);

        // Track progress regardless of success
        completedModules++;
        onProgress?.({ phase: 'storing' as any, current: completedModules, total: modules.length, modulePath: undefined });
      }
    };

    // Start concurrent workers
    const modWorkerCount = Math.min(WIKI_CONCURRENCY, modules.length);
    const modWorkers: Promise<void>[] = [];
    for (let i = 0; i < modWorkerCount; i++) {
      modWorkers.push(moduleWorker());
    }
    await Promise.all(modWorkers);
    if (signal.aborted) return;

    if (cachedModules > 0) {
      console.log(`[Wiki] Cache hit: ${cachedModules}/${modules.length} modules skipped (sourceHash unchanged)`);
    }

    // Collect results (preserving original module order)
    for (const result of moduleResults) {
      if (result) {
        manifestModules.push(result.entry);
        moduleSummaries.push(result.summary);
      }
    }

    if (signal.aborted) return;

    // Phase 3: Generate overview
    onProgress?.({ phase: 'overview', current: 0, total: 1 });
    const overviewContent = await this.callLLM(provider, buildOverviewPrompt(moduleSummaries, lang), signal);
    if (signal.aborted) return;

    await this.writeContentFile(workspace, lang, '_overview.md', overviewContent);

    // Save manifest
    let baseCommit = '';
    try {
      baseCommit = await gitRevParseHead(workspace);
    } catch { /* not a git repo */ }

    const manifest: WikiManifest = {
      version: 1,
      baseCommit,
      generatedAt: new Date().toISOString(),
      language: lang,
      modules: manifestModules,
    };
    await this.saveManifest(workspace, lang, manifest);

    onProgress?.({ phase: 'done', current: modules.length, total: modules.length });
  }

  // --- Change Detection ---

  async detectChanges(workspace: string): Promise<ChangeDetectionResult> {
    const loaded = await loadConfig();
    const lang = loaded.config.wiki.language as 'en' | 'zh';
    const manifest = await this.loadManifest(workspace, lang);

    if (!manifest) {
      return { changedModules: [], baseCommit: '', currentCommit: '' };
    }

    const currentCommit = await gitRevParseHead(workspace);
    if (!manifest.baseCommit || manifest.baseCommit === currentCommit) {
      return { changedModules: [], baseCommit: manifest.baseCommit, currentCommit };
    }

    const changedFiles = await gitDiffNameOnly(workspace, manifest.baseCommit, currentCommit);

    // Map changed files to affected modules
    const changedModuleSet = new Set<string>();
    for (const filePath of changedFiles) {
      for (const mod of manifest.modules) {
        if (filePath.startsWith(mod.path + '/') || filePath.startsWith(mod.path + '\\')) {
          changedModuleSet.add(mod.path);
        }
      }
    }

    return {
      changedModules: Array.from(changedModuleSet),
      baseCommit: manifest.baseCommit,
      currentCommit,
    };
  }

  // --- Incremental Update ---

  async updateModules(
    workspace: string,
    changedModulePaths: string[],
    onProgress: (p: WikiProgress) => void
  ): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const loaded = await loadConfig();
    const config = loaded.config;
    const lang = config.wiki.language as 'en' | 'zh';
    const provider = this.createWikiProvider(config);
    const manifest = await this.loadManifest(workspace, lang);

    if (!manifest) return;

    const currentCommit = await gitRevParseHead(workspace);

    // Get all changed files once (shared across workers)
    const allChangedFiles = await gitDiffNameOnly(workspace, manifest.baseCommit, currentCommit);

    const UPDATE_CONCURRENCY = config.wiki.concurrency ?? 3;
    let updateIndex = 0;
    let updatedModules = 0;

    const processUpdate = async (): Promise<void> => {
      while (!signal.aborted) {
        const idx = updateIndex++;
        if (idx >= changedModulePaths.length) return;

        const modPath = changedModulePaths[idx];
        onProgress?.({ phase: 'updating', current: idx + 1, total: changedModulePaths.length, modulePath: modPath });

        const entry = manifest.modules.find((m) => m.path === modPath);
        if (!entry) continue;

        // Read existing content
        const existingContent = await this.readContentFile(workspace, lang, entry.contentFile);

        // Filter changed files for this module (from pre-fetched allChangedFiles)
        const moduleChangedFiles = allChangedFiles.filter(
          (f) => f.startsWith(modPath + '/') || f.startsWith(modPath + '\\')
        );

        const fileInfos: FileInfo[] = [];
        for (const fp of moduleChangedFiles) {
          try {
            const content = await readFile(join(workspace, fp), 'utf-8');
            if (content.length <= MAX_FILE_SIZE) {
              fileInfos.push({ path: fp, content });
            }
          } catch { /* file may have been deleted */ }
        }

        if (fileInfos.length === 0 && existingContent) continue;

        const newContent = existingContent
          ? await this.callLLM(provider, buildUpdatePrompt(modPath, existingContent, fileInfos, lang), signal)
          : await this.callLLM(provider, buildModulePrompt(modPath, fileInfos, lang), signal);

        if (signal.aborted) return;

        await this.writeContentFile(workspace, lang, entry.contentFile, newContent);

        // Update manifest entry
        entry.sourceHash = this.hashContent(fileInfos.map((f) => f.content).join(''));
        entry.contentHash = this.hashContent(newContent);
        entry.generatedAt = new Date().toISOString();

        const titleMatch = newContent.match(/^#\s+(.+)/m);
        if (titleMatch) entry.title = titleMatch[1].trim();

        updatedModules++;
        onProgress?.({ phase: 'storing' as any, current: updatedModules, total: changedModulePaths.length, modulePath: undefined });
      }
    };

    const updateWorkerCount = Math.min(UPDATE_CONCURRENCY, changedModulePaths.length);
    const updateWorkers = [];
    for (let i = 0; i < updateWorkerCount; i++) {
      // @ts-expect-error - Promise<void> in never[]
      updateWorkers.push(processUpdate());
    }
    await Promise.all(updateWorkers);

    if (signal.aborted) return;

    // Regenerate overview
    onProgress?.({ phase: 'overview', current: 0, total: 1 });
    const summaries = manifest.modules.map((m) => ({
      path: m.path,
      title: m.title,
      fileCount: m.fileCount,
    }));
    const overviewContent = await this.callLLM(provider, buildOverviewPrompt(summaries, lang), signal);
    if (signal.aborted) return;

    await this.writeContentFile(workspace, lang, '_overview.md', overviewContent);

    // Update manifest base commit
    manifest.baseCommit = currentCommit;
    manifest.generatedAt = new Date().toISOString();
    await this.saveManifest(workspace, lang, manifest);

    onProgress?.({ phase: 'done', current: changedModulePaths.length, total: changedModulePaths.length });
  }

  // --- External Edit Sync ---

  async checkExternalEdits(workspace: string): Promise<string[]> {
    const loaded = await loadConfig();
    const lang = loaded.config.wiki.language as 'en' | 'zh';
    const manifest = await this.loadManifest(workspace, lang);
    if (!manifest) return [];

    const editedModules: string[] = [];
    for (const entry of manifest.modules) {
      const content = await this.readContentFile(workspace, lang, entry.contentFile);
      if (content === null) continue;
      const currentHash = this.hashContent(content);
      if (currentHash !== entry.contentHash) {
        editedModules.push(entry.path);
      }
    }
    return editedModules;
  }

  // --- Status ---

  async getStatus(workspace: string): Promise<WikiStatus> {
    const loaded = await loadConfig();
    const lang = loaded.config.wiki.language as 'en' | 'zh';
    const manifest = await this.loadManifest(workspace, lang);

    if (!manifest) {
      return { hasWiki: false, language: lang, moduleCount: 0, baseCommit: '', generatedAt: '' };
    }

    return {
      hasWiki: true,
      language: manifest.language,
      moduleCount: manifest.modules.length,
      baseCommit: manifest.baseCommit,
      generatedAt: manifest.generatedAt,
    };
  }

  // --- TOC & Content ---

  async loadToc(workspace: string): Promise<{ modules: Array<{ path: string; title: string; fileCount: number }>; hasOverview: boolean }> {
    const loaded = await loadConfig();
    const lang = loaded.config.wiki.language as 'en' | 'zh';
    const manifest = await this.loadManifest(workspace, lang);
    if (!manifest) return { modules: [], hasOverview: false };

    const overviewPath = join(workspace, WIKI_DIR, lang, 'content', '_overview.md');
    const hasOverview = existsSync(overviewPath);

    return {
      modules: manifest.modules.map((m) => ({ path: m.path, title: m.title, fileCount: m.fileCount })),
      hasOverview,
    };
  }

  async loadContent(workspace: string, modulePath: string): Promise<string> {
    const loaded = await loadConfig();
    const lang = loaded.config.wiki.language as 'en' | 'zh';

    if (modulePath === 'overview') {
      return (await this.readContentFile(workspace, lang, '_overview.md')) || '';
    }

    const manifest = await this.loadManifest(workspace, lang);
    if (!manifest) return '';

    const entry = manifest.modules.find((m) => m.path === modulePath);
    if (!entry) return '';

    return (await this.readContentFile(workspace, lang, entry.contentFile)) || '';
  }

  // --- File Scanning ---

  async scanModules(workspace: string, ignorePaths: string[]): Promise<ModuleInfo[]> {
    const modules = new Map<string, string[]>();
    let totalFiles = 0;

    const ignoreSet = new Set(ignorePaths.map((p) => p.trim()).filter(Boolean));

    async function walk(dir: string, depth: number): Promise<void> {
      if (depth > 8 || totalFiles >= MAX_TOTAL_FILES) return;

      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (totalFiles >= MAX_TOTAL_FILES) return;

        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          if (entry.name.startsWith('.')) continue;
          const relPath = relative(workspace, join(dir, entry.name)).replace(/\\/g, '/');
          if (ignoreSet.has(relPath) || ignoreSet.has(entry.name)) continue;
          await walk(join(dir, entry.name), depth + 1);
        } else {
          const ext = '.' + entry.name.split('.').pop()!.toLowerCase();
          if (!CODE_EXTENSIONS.has(ext)) continue;

          const filePath = join(dir, entry.name);
          const relFile = relative(workspace, filePath).replace(/\\/g, '/');

          // Determine module: parent directory relative to workspace
          const relDir = relative(workspace, dir).replace(/\\/g, '/');
          const modulePath = relDir || '.';

          if (!modules.has(modulePath)) {
            modules.set(modulePath, []);
          }
          modules.get(modulePath)!.push(relFile);
          totalFiles++;
        }
      }
    }

    await walk(workspace, 0);

    return Array.from(modules.entries())
      .map(([path, files]) => ({ path, files }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  // --- Private Helpers ---

  private createWikiProvider(config: AppConfig): LLMProvider {
    if (config.wiki.model) {
      // Create a modified config with the wiki model
      const wikiConfig = { ...config, model: config.wiki.model };
      return createProvider(wikiConfig);
    }
    return createProvider(config);
  }

  private async readModuleFiles(workspace: string, mod: ModuleInfo, maxFiles: number): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const filesToRead = mod.files.slice(0, maxFiles);

    for (const fp of filesToRead) {
      try {
        const fullPath = join(workspace, fp);
        const s = await stat(fullPath);
        if (s.size > MAX_FILE_SIZE) continue;
        const content = await readFile(fullPath, 'utf-8');
        files.push({ path: fp, content });
      } catch {
        // skip unreadable files
      }
    }

    return files;
  }

  private async callLLM(provider: LLMProvider, prompt: string, signal: AbortSignal): Promise<string> {
    let result = '';
    const stream = provider.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 4096,
    });

    for await (const event of stream) {
      if (signal.aborted) return result;
      if (event.type === 'text_delta') {
        result += event.text;
      }
    }

    return result;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private async loadManifest(workspace: string, lang: string): Promise<WikiManifest | null> {
    const manifestPath = join(workspace, WIKI_DIR, lang, 'meta', 'manifest.json');
    if (!existsSync(manifestPath)) return null;
    try {
      const raw = await readFile(manifestPath, 'utf-8');
      return JSON.parse(raw) as WikiManifest;
    } catch {
      return null;
    }
  }

  private async saveManifest(workspace: string, lang: string, manifest: WikiManifest): Promise<void> {
    const metaDir = join(workspace, WIKI_DIR, lang, 'meta');
    if (!existsSync(metaDir)) {
      await mkdir(metaDir, { recursive: true });
    }
    await writeFile(join(metaDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }

  private async writeContentFile(workspace: string, lang: string, fileName: string, content: string): Promise<void> {
    const contentDir = join(workspace, WIKI_DIR, lang, 'content');
    if (!existsSync(contentDir)) {
      await mkdir(contentDir, { recursive: true });
    }
    await writeFile(join(contentDir, fileName), content, 'utf-8');
  }

  private async readContentFile(workspace: string, lang: string, fileName: string): Promise<string | null> {
    const filePath = join(workspace, WIKI_DIR, lang, 'content', fileName);
    if (!existsSync(filePath)) return null;
    try {
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }
}
