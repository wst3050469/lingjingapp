import type { DatasetEntry, DatasetStatus, ScriptLanguage } from './types.js';
import type { OpenSpaceBridge } from './bridge.js';
import type { IEventBus, EventTopic } from '../event-bus/types.js';
import { logger } from '../../utils/logger.js';

export interface IFileSystem {
  readdir(path: string): Promise<string[]>;
  readFile(path: string, encoding: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ isDirectory(): boolean }>;
}

interface DatasetTypeMapping {
  extensions: string[];
  type: string;
}

const TYPE_MAPPINGS: DatasetTypeMapping[] = [
  { extensions: ['.json', '.scene'], type: 'scene' },
  { extensions: ['.spe', '.speck'], type: 'pointcloud' },
  { extensions: ['.fits', '.fit'], type: 'fits' },
  { extensions: ['.vtk'], type: 'volume' },
  { extensions: ['.obj', '.ply', '.stl'], type: 'mesh' },
  { extensions: ['.png', '.jpg', '.jpeg', '.tiff', '.tif'], type: 'image' },
  { extensions: ['.csv', '.tsv', '.dat'], type: 'table' },
];

const MAX_SCAN_DEPTH = 3;

function inferType(filename: string): string {
  const lower = filename.toLowerCase();
  for (const mapping of TYPE_MAPPINGS) {
    for (const ext of mapping.extensions) {
      if (lower.endsWith(ext)) return mapping.type;
    }
  }
  return 'unknown';
}

function escapeLuaString(s: string): string {
  return s.replace(/\\/g, '/').replace(/"/g, '\\"');
}

export class OpenSpaceDatasetBrowser {
  private fs: IFileSystem | null;
  private bridge: OpenSpaceBridge | null;
  private eventBus: IEventBus | null;
  private datasetsCache = new Map<string, DatasetEntry>();
  private lastScanTime = 0;
  private readonly cacheTtl = 30000;

  constructor(fs?: IFileSystem, bridge?: OpenSpaceBridge, eventBus?: IEventBus) {
    this.fs = fs ?? null;
    this.bridge = bridge ?? null;
    this.eventBus = eventBus ?? null;
  }

  async scanDatasets(dataDir: string): Promise<DatasetEntry[]> {
    if (!this.fs) {
      return [...this.datasetsCache.values()];
    }

    if (this.isCacheValid()) {
      return [...this.datasetsCache.values()];
    }

    this.datasetsCache.clear();

    try {
      await this.scanDirectory(dataDir, 0);
    } catch (err) {
      logger.warn(`[DatasetBrowser] scan failed: ${(err as Error).message}`);
    }

    this.lastScanTime = Date.now();
    return [...this.datasetsCache.values()];
  }

  getDatasetInfo(name: string): DatasetEntry {
    const cached = this.datasetsCache.get(name);
    if (cached) return cached;
    throw new Error(`Dataset "${name}" not found in cache. Run scanDatasets first.`);
  }

  async loadDataset(name: string): Promise<void> {
    const entry = this.datasetsCache.get(name);
    if (!entry) {
      throw new Error(`Dataset "${name}" not found`);
    }

    if (entry.status === 'loaded') {
      logger.info(`[DatasetBrowser] dataset already loaded: ${name}`);
      return;
    }

    if (!this.bridge || !this.bridge.isConnected) {
      throw new Error('OpenSpace bridge not connected');
    }

    entry.status = 'loading';

    const script = `openspace.addSceneGraphNode("${escapeLuaString(name)}")`;
    const result = await this.bridge.sendScript({
      script,
      language: 'lua' as ScriptLanguage,
      timeout: 30000,
    });

    if (result.success) {
      entry.status = 'loaded';
      if (this.eventBus) {
        this.eventBus.publish('openspace:dataset_loaded' as EventTopic, { name, path: entry.path, type: entry.type }, 'openspace-dataset-browser');
      }
      logger.info(`[DatasetBrowser] loaded dataset: ${name}`);
    } else {
      entry.status = 'error';
      logger.error(`[DatasetBrowser] failed to load dataset: ${name} - ${result.error}`);
      throw new Error(`Failed to load dataset "${name}": ${result.error ?? 'unknown error'}`);
    }
  }

  async unloadDataset(name: string): Promise<void> {
    const entry = this.datasetsCache.get(name);
    if (!entry) {
      throw new Error(`Dataset "${name}" not found`);
    }

    if (entry.status !== 'loaded') {
      logger.info(`[DatasetBrowser] dataset not loaded: ${name}`);
      return;
    }

    if (!this.bridge || !this.bridge.isConnected) {
      throw new Error('OpenSpace bridge not connected');
    }

    const script = `openspace.removeSceneGraphNode("${escapeLuaString(name)}")`;
    const result = await this.bridge.sendScript({
      script,
      language: 'lua' as ScriptLanguage,
      timeout: 15000,
    });

    if (result.success) {
      entry.status = 'unloaded';
      if (this.eventBus) {
        this.eventBus.publish('openspace:dataset_unloaded' as EventTopic, { name, path: entry.path }, 'openspace-dataset-browser');
      }
      logger.info(`[DatasetBrowser] unloaded dataset: ${name}`);
    } else {
      entry.status = 'error';
      logger.error(`[DatasetBrowser] failed to unload dataset: ${name} - ${result.error}`);
      throw new Error(`Failed to unload dataset "${name}": ${result.error ?? 'unknown error'}`);
    }
  }

  searchDatasets(query: string): DatasetEntry[] {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [...this.datasetsCache.values()];

    const results: DatasetEntry[] = [];

    for (const entry of this.datasetsCache.values()) {
      if (entry.name.toLowerCase().includes(normalized)) {
        results.push(entry);
        continue;
      }
      if (entry.type.toLowerCase().includes(normalized)) {
        results.push(entry);
        continue;
      }
      if (entry.metadata) {
        for (const value of Object.values(entry.metadata)) {
          if (value.toLowerCase().includes(normalized)) {
            results.push(entry);
            break;
          }
        }
      }
    }

    return results;
  }

  getLoadedDatasets(): DatasetEntry[] {
    const loaded: DatasetEntry[] = [];
    for (const entry of this.datasetsCache.values()) {
      if (entry.status === 'loaded') loaded.push(entry);
    }
    return loaded;
  }

  clearCache(): void {
    this.datasetsCache.clear();
    this.lastScanTime = 0;
  }

  setBridge(bridge: OpenSpaceBridge): void {
    this.bridge = bridge;
  }

  setFileSystem(fs: IFileSystem): void {
    this.fs = fs;
  }

  private isCacheValid(): boolean {
    return this.datasetsCache.size > 0 && (Date.now() - this.lastScanTime) < this.cacheTtl;
  }

  private async scanDirectory(dirPath: string, depth: number): Promise<void> {
    if (depth > MAX_SCAN_DEPTH) return;
    if (!this.fs) return;

    let entries: string[];
    try {
      const exists = await this.fs.exists(dirPath);
      if (!exists) return;
      entries = await this.fs.readdir(dirPath);
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = this.joinPath(dirPath, entry);

      try {
        const stat = await this.fs!.stat(entryPath);

        if (stat.isDirectory()) {
          this.datasetsCache.set(entry, {
            name: entry,
            path: entryPath,
            status: 'unloaded' as DatasetStatus,
            type: 'directory',
            metadata: { path: entryPath },
          });
          await this.scanDirectory(entryPath, depth + 1);
        } else {
          const datasetType = inferType(entry);
          if (datasetType !== 'unknown') {
            this.datasetsCache.set(entry, {
              name: entry,
              path: entryPath,
              status: 'unloaded' as DatasetStatus,
              type: datasetType,
              metadata: { path: entryPath },
            });
          }
        }
      } catch {
        continue;
      }
    }
  }

  private joinPath(...segments: string[]): string {
    return segments.join('/').replace(/\/+/g, '/');
  }
}
