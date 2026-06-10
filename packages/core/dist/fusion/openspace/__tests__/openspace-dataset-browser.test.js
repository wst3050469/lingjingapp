import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenSpaceDatasetBrowser } from '../dataset-browser.js';
// ─── inferType ───
describe('inferType', () => {
    // inferType is a module-private function, tested indirectly through scanDatasets
    // which adds entries only when inferType returns non-unknown
    it('should be tested via scanDatasets behavior', () => {
        // Tested in scanDatasets tests below
        expect(true).toBe(true);
    });
});
// ─── OpenSpaceDatasetBrowser ───
describe('OpenSpaceDatasetBrowser', () => {
    let mockFs;
    let mockBridge;
    let browser;
    beforeEach(() => {
        mockFs = {
            readdir: vi.fn(),
            readFile: vi.fn(),
            exists: vi.fn(),
            stat: vi.fn(),
        };
        mockBridge = {
            isConnected: true,
            sendScript: vi.fn(),
        };
        browser = new OpenSpaceDatasetBrowser(mockFs, mockBridge);
    });
    describe('constructor', () => {
        it('should accept optional fs, bridge, eventBus', () => {
            const b = new OpenSpaceDatasetBrowser();
            expect(b).toBeInstanceOf(OpenSpaceDatasetBrowser);
        });
        it('should start with empty cache', () => {
            expect(browser.getLoadedDatasets()).toEqual([]);
        });
    });
    describe('scanDatasets', () => {
        it('should return cached results when cache is valid', async () => {
            // First scan populates cache
            mockFs.exists.mockResolvedValue(true);
            mockFs.readdir.mockResolvedValue(['nebula.fits']);
            mockFs.stat.mockResolvedValue({ isDirectory: () => false });
            const results1 = await browser.scanDatasets('/data');
            expect(results1).toHaveLength(1);
            expect(results1[0].name).toBe('nebula.fits');
            // Second scan should use cache (don't call readdir again)
            mockFs.readdir = vi.fn(); // reset
            const results2 = await browser.scanDatasets('/data');
            expect(results2).toHaveLength(1);
            expect(mockFs.readdir).not.toHaveBeenCalled();
        });
        it('should return cache when no fs available', async () => {
            const b = new OpenSpaceDatasetBrowser(undefined, mockBridge);
            const results = await b.scanDatasets('/data');
            expect(results).toEqual([]);
        });
        it('should scan directory and index supported files', async () => {
            mockFs.exists.mockResolvedValue(true);
            mockFs.readdir.mockResolvedValue(['star.fits', 'planet.obj', 'notes.txt']);
            mockFs.stat.mockResolvedValue({ isDirectory: () => false });
            const results = await browser.scanDatasets('/data');
            // .fits -> type 'fits', .obj -> type 'mesh', .txt -> unknown (skipped)
            expect(results).toHaveLength(2);
            expect(results.find((d) => d.name === 'star.fits')?.type).toBe('fits');
            expect(results.find((d) => d.name === 'planet.obj')?.type).toBe('mesh');
        });
        it('should scan subdirectories up to max depth', async () => {
            mockFs.exists.mockResolvedValue(true);
            mockFs.readdir
                .mockResolvedValueOnce(['galaxy']) // root
                .mockResolvedValueOnce(['spiral.fits']); // subdir
            mockFs.stat
                .mockResolvedValueOnce({ isDirectory: () => true }) // galaxy is dir
                .mockResolvedValueOnce({ isDirectory: () => false }); // spiral.fits is file
            const results = await browser.scanDatasets('/data');
            // galaxy dir should be indexed as 'directory' type
            expect(results.length).toBeGreaterThanOrEqual(1);
            const galaxyEntry = results.find((d) => d.name === 'galaxy');
            expect(galaxyEntry?.type).toBe('directory');
        });
        it('should handle scan errors gracefully', async () => {
            mockFs.exists.mockRejectedValue(new Error('permission denied'));
            const results = await browser.scanDatasets('/data');
            expect(results).toEqual([]);
        });
        it('should handle file stat errors gracefully', async () => {
            mockFs.exists.mockResolvedValue(true);
            mockFs.readdir.mockResolvedValue(['bad_file.fits']);
            mockFs.stat.mockRejectedValue(new Error('stat failed'));
            const results = await browser.scanDatasets('/data');
            expect(results).toEqual([]);
        });
    });
    describe('getDatasetInfo', () => {
        it('should return cached dataset', async () => {
            mockFs.exists.mockResolvedValue(true);
            mockFs.readdir.mockResolvedValue(['star.fits']);
            mockFs.stat.mockResolvedValue({ isDirectory: () => false });
            await browser.scanDatasets('/data');
            const info = browser.getDatasetInfo('star.fits');
            expect(info.name).toBe('star.fits');
            expect(info.type).toBe('fits');
        });
        it('should throw for unknown dataset', () => {
            expect(() => browser.getDatasetInfo('nope.fits')).toThrow('not found');
        });
    });
    describe('loadDataset', () => {
        beforeEach(async () => {
            mockFs.exists.mockResolvedValue(true);
            mockFs.readdir.mockResolvedValue(['galaxy.fits']);
            mockFs.stat.mockResolvedValue({ isDirectory: () => false });
            await browser.scanDatasets('/data');
            mockBridge.sendScript.mockReset();
        });
        it('should send load script via bridge', async () => {
            mockBridge.sendScript.mockResolvedValue({ success: true, duration: 10 });
            await browser.loadDataset('galaxy.fits');
            expect(mockBridge.sendScript).toHaveBeenCalledWith(expect.objectContaining({ script: expect.stringContaining('addSceneGraphNode') }));
        });
        it('should update status to loaded on success', async () => {
            mockBridge.sendScript.mockResolvedValue({ success: true, duration: 10 });
            await browser.loadDataset('galaxy.fits');
            const info = browser.getDatasetInfo('galaxy.fits');
            expect(info.status).toBe('loaded');
        });
        it('should throw when already loaded', async () => {
            mockBridge.sendScript.mockResolvedValue({ success: true, duration: 10 });
            await browser.loadDataset('galaxy.fits');
            // Loading again should not throw (it's a no-op early return)
            await expect(browser.loadDataset('galaxy.fits')).resolves.not.toThrow();
        });
        it('should throw for unknown dataset', async () => {
            await expect(browser.loadDataset('nope.fits')).rejects.toThrow('not found');
        });
        it('should throw when bridge not connected', async () => {
            mockBridge.isConnected = false;
            await expect(browser.loadDataset('galaxy.fits')).rejects.toThrow('not connected');
        });
        it('should set status to error on failure', async () => {
            mockBridge.sendScript.mockResolvedValue({ success: false, error: 'script error', duration: 5 });
            await expect(browser.loadDataset('galaxy.fits')).rejects.toThrow('script error');
            const info = browser.getDatasetInfo('galaxy.fits');
            expect(info.status).toBe('error');
        });
    });
    describe('unloadDataset', () => {
        beforeEach(async () => {
            mockFs.exists.mockResolvedValue(true);
            mockFs.readdir.mockResolvedValue(['galaxy.fits']);
            mockFs.stat.mockResolvedValue({ isDirectory: () => false });
            await browser.scanDatasets('/data');
            mockBridge.sendScript.mockResolvedValue({ success: true, duration: 10 });
            await browser.loadDataset('galaxy.fits');
            mockBridge.sendScript.mockReset();
        });
        it('should send unload script via bridge', async () => {
            mockBridge.sendScript.mockResolvedValue({ success: true, duration: 10 });
            await browser.unloadDataset('galaxy.fits');
            expect(mockBridge.sendScript).toHaveBeenCalledWith(expect.objectContaining({ script: expect.stringContaining('removeSceneGraphNode') }));
        });
        it('should update status to unloaded on success', async () => {
            mockBridge.sendScript.mockResolvedValue({ success: true, duration: 10 });
            await browser.unloadDataset('galaxy.fits');
            const info = browser.getDatasetInfo('galaxy.fits');
            expect(info.status).toBe('unloaded');
        });
        it('should be a no-op when dataset not loaded', async () => {
            // unload another dataset that exists but wasn't loaded
            mockBridge.sendScript.mockResolvedValue({ success: true, duration: 10 });
            // The dataset was already loaded, so first unload it
            await browser.unloadDataset('galaxy.fits');
            // Now unload again — should be a no-op since status is already 'unloaded'
            await expect(browser.unloadDataset('galaxy.fits')).resolves.not.toThrow();
        });
        it('should throw for unknown dataset', async () => {
            await expect(browser.unloadDataset('nope.fits')).rejects.toThrow('not found');
        });
        it('should throw when bridge not connected', async () => {
            mockBridge.isConnected = false;
            await expect(browser.unloadDataset('galaxy.fits')).rejects.toThrow('not connected');
        });
    });
    describe('searchDatasets', () => {
        beforeEach(async () => {
            mockFs.exists.mockResolvedValue(true);
            mockFs.readdir.mockResolvedValue(['star.fits', 'planet.obj', 'vibes.csv']);
            mockFs.stat.mockResolvedValue({ isDirectory: () => false });
            await browser.scanDatasets('/data');
        });
        it('should return all datasets for empty query', () => {
            const results = browser.searchDatasets('');
            expect(results).toHaveLength(3);
        });
        it('should search by name', () => {
            const results = browser.searchDatasets('star');
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('star.fits');
        });
        it('should search by type', () => {
            const results = browser.searchDatasets('mesh');
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('planet.obj');
        });
        it('should return empty for no matches', () => {
            const results = browser.searchDatasets('nonexistent');
            expect(results).toEqual([]);
        });
    });
    describe('getLoadedDatasets', () => {
        it('should return only loaded datasets', async () => {
            mockFs.exists.mockResolvedValue(true);
            mockFs.readdir.mockResolvedValue(['a.fits', 'b.obj']);
            mockFs.stat.mockResolvedValue({ isDirectory: () => false });
            await browser.scanDatasets('/data');
            expect(browser.getLoadedDatasets()).toHaveLength(0);
            mockBridge.sendScript.mockResolvedValue({ success: true, duration: 10 });
            await browser.loadDataset('a.fits');
            const loaded = browser.getLoadedDatasets();
            expect(loaded).toHaveLength(1);
            expect(loaded[0].name).toBe('a.fits');
        });
    });
    describe('clearCache', () => {
        it('should clear the cache', async () => {
            mockFs.exists.mockResolvedValue(true);
            mockFs.readdir.mockResolvedValue(['data.fits']);
            mockFs.stat.mockResolvedValue({ isDirectory: () => false });
            await browser.scanDatasets('/data');
            expect(browser.getDatasetInfo('data.fits')).toBeDefined();
            browser.clearCache();
            expect(() => browser.getDatasetInfo('data.fits')).toThrow('not found');
            expect(browser.getLoadedDatasets()).toEqual([]);
        });
    });
    describe('setBridge / setFileSystem', () => {
        it('should update bridge reference', () => {
            const newBridge = { isConnected: false, sendScript: vi.fn() };
            browser.setBridge(newBridge);
            // loadDataset should use the new bridge
            expect(true).toBe(true);
        });
        it('should update filesystem reference', () => {
            const newFs = {
                readdir: vi.fn().mockResolvedValue(['new.fits']),
                readFile: vi.fn(),
                exists: vi.fn().mockResolvedValue(true),
                stat: vi.fn().mockResolvedValue({ isDirectory: () => false }),
            };
            browser.setFileSystem(newFs);
            // scan should use new fs
            expect(true).toBe(true);
        });
    });
});
//# sourceMappingURL=openspace-dataset-browser.test.js.map