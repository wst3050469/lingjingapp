import { logger } from '../../utils/logger.js';
const TYPE_MAPPINGS = [
    { extensions: ['.json', '.scene'], type: 'scene' },
    { extensions: ['.spe', '.speck'], type: 'pointcloud' },
    { extensions: ['.fits', '.fit'], type: 'fits' },
    { extensions: ['.vtk'], type: 'volume' },
    { extensions: ['.obj', '.ply', '.stl'], type: 'mesh' },
    { extensions: ['.png', '.jpg', '.jpeg', '.tiff', '.tif'], type: 'image' },
    { extensions: ['.csv', '.tsv', '.dat'], type: 'table' },
];
const MAX_SCAN_DEPTH = 3;
function inferType(filename) {
    const lower = filename.toLowerCase();
    for (const mapping of TYPE_MAPPINGS) {
        for (const ext of mapping.extensions) {
            if (lower.endsWith(ext))
                return mapping.type;
        }
    }
    return 'unknown';
}
function escapeLuaString(s) {
    return s.replace(/\\/g, '/').replace(/"/g, '\\"');
}
export class OpenSpaceDatasetBrowser {
    fs;
    bridge;
    eventBus;
    datasetsCache = new Map();
    lastScanTime = 0;
    cacheTtl = 30000;
    constructor(fs, bridge, eventBus) {
        this.fs = fs ?? null;
        this.bridge = bridge ?? null;
        this.eventBus = eventBus ?? null;
    }
    async scanDatasets(dataDir) {
        if (!this.fs) {
            return [...this.datasetsCache.values()];
        }
        if (this.isCacheValid()) {
            return [...this.datasetsCache.values()];
        }
        this.datasetsCache.clear();
        try {
            await this.scanDirectory(dataDir, 0);
        }
        catch (err) {
            logger.warn(`[DatasetBrowser] scan failed: ${err.message}`);
        }
        this.lastScanTime = Date.now();
        return [...this.datasetsCache.values()];
    }
    getDatasetInfo(name) {
        const cached = this.datasetsCache.get(name);
        if (cached)
            return cached;
        throw new Error(`Dataset "${name}" not found in cache. Run scanDatasets first.`);
    }
    async loadDataset(name) {
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
            language: 'lua',
            timeout: 30000,
        });
        if (result.success) {
            entry.status = 'loaded';
            if (this.eventBus) {
                this.eventBus.publish('openspace:dataset_loaded', { name, path: entry.path, type: entry.type }, 'openspace-dataset-browser');
            }
            logger.info(`[DatasetBrowser] loaded dataset: ${name}`);
        }
        else {
            entry.status = 'error';
            logger.error(`[DatasetBrowser] failed to load dataset: ${name} - ${result.error}`);
            throw new Error(`Failed to load dataset "${name}": ${result.error ?? 'unknown error'}`);
        }
    }
    async unloadDataset(name) {
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
            language: 'lua',
            timeout: 15000,
        });
        if (result.success) {
            entry.status = 'unloaded';
            if (this.eventBus) {
                this.eventBus.publish('openspace:dataset_unloaded', { name, path: entry.path }, 'openspace-dataset-browser');
            }
            logger.info(`[DatasetBrowser] unloaded dataset: ${name}`);
        }
        else {
            entry.status = 'error';
            logger.error(`[DatasetBrowser] failed to unload dataset: ${name} - ${result.error}`);
            throw new Error(`Failed to unload dataset "${name}": ${result.error ?? 'unknown error'}`);
        }
    }
    searchDatasets(query) {
        const normalized = query.toLowerCase().trim();
        if (!normalized)
            return [...this.datasetsCache.values()];
        const results = [];
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
    getLoadedDatasets() {
        const loaded = [];
        for (const entry of this.datasetsCache.values()) {
            if (entry.status === 'loaded')
                loaded.push(entry);
        }
        return loaded;
    }
    clearCache() {
        this.datasetsCache.clear();
        this.lastScanTime = 0;
    }
    setBridge(bridge) {
        this.bridge = bridge;
    }
    setFileSystem(fs) {
        this.fs = fs;
    }
    isCacheValid() {
        return this.datasetsCache.size > 0 && (Date.now() - this.lastScanTime) < this.cacheTtl;
    }
    async scanDirectory(dirPath, depth) {
        if (depth > MAX_SCAN_DEPTH)
            return;
        if (!this.fs)
            return;
        let entries;
        try {
            const exists = await this.fs.exists(dirPath);
            if (!exists)
                return;
            entries = await this.fs.readdir(dirPath);
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const entryPath = this.joinPath(dirPath, entry);
            try {
                const stat = await this.fs.stat(entryPath);
                if (stat.isDirectory()) {
                    this.datasetsCache.set(entry, {
                        name: entry,
                        path: entryPath,
                        status: 'unloaded',
                        type: 'directory',
                        metadata: { path: entryPath },
                    });
                    await this.scanDirectory(entryPath, depth + 1);
                }
                else {
                    const datasetType = inferType(entry);
                    if (datasetType !== 'unknown') {
                        this.datasetsCache.set(entry, {
                            name: entry,
                            path: entryPath,
                            status: 'unloaded',
                            type: datasetType,
                            metadata: { path: entryPath },
                        });
                    }
                }
            }
            catch {
                continue;
            }
        }
    }
    joinPath(...segments) {
        return segments.join('/').replace(/\/+/g, '/');
    }
}
//# sourceMappingURL=dataset-browser.js.map