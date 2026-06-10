import React, { useState, useEffect } from 'react';
import { useOpenSpaceStore } from '../../stores/openspace-store';

const statusColors: Record<string, string> = {
  loaded: 'text-green-400',
  unloaded: 'text-gray-500',
  loading: 'text-yellow-400 animate-pulse',
  error: 'text-red-400',
};

const statusIcons: Record<string, string> = {
  loaded: '●',
  unloaded: '○',
  loading: '◌',
  error: '✕',
};

export function OpenSpaceDatasetTree() {
  const { datasets, datasetRoot, scanDatasets, searchDatasets, loadDataset, unloadDataset } = useOpenSpaceStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    scanDatasets(datasetRoot || undefined);
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchDatasets(searchQuery);
    } else {
      scanDatasets(datasetRoot || undefined);
    }
  };

  // Group by type
  const categories = ['scene', 'pointcloud', 'fits', 'volume', 'mesh', 'image', 'table', 'directory', 'unknown'];
  const grouped = new Map<string, typeof datasets>();
  for (const ds of datasets) {
    const cat = categories.includes(ds.type) ? ds.type : 'other';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(ds);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-200">数据集</h2>
        <button
          onClick={() => scanDatasets(datasetRoot || undefined)}
          className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
        >
          刷新
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索数据集名称/类型..."
            className="flex-1 rounded bg-gray-800 border border-gray-600 px-2 py-1 text-xs text-gray-200 placeholder-gray-500"
          />
          <button
            onClick={handleSearch}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
          >
            搜索
          </button>
        </div>
      </div>

      {/* Dataset root path */}
      {datasetRoot && (
        <div className="px-3 pt-1">
          <span className="text-xs text-gray-500">路径: {datasetRoot}</span>
        </div>
      )}

      {/* Dataset list grouped by category */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {datasets.length === 0 ? (
          <p className="text-center text-xs text-gray-500 py-8">无数据集</p>
        ) : (
          [...grouped.entries()].map(([category, items]) => (
            <div key={category}>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">{category}</h3>
              <div className="space-y-1">
                {items.map((ds) => (
                  <div
                    key={`${ds.path}-${ds.name}`}
                    className="flex items-center justify-between rounded border border-gray-700 bg-gray-800 px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs ${statusColors[ds.status] || 'text-gray-500'}`}>
                        {statusIcons[ds.status] || '?'}
                      </span>
                      <span className="text-xs text-gray-200 truncate">{ds.name}</span>
                      <span className="text-xs text-gray-600 flex-shrink-0">({ds.type})</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {ds.status !== 'loaded' ? (
                        <button
                          onClick={() => loadDataset(ds.name)}
                          disabled={ds.status === 'loading'}
                          className="rounded bg-green-700 px-2 py-0.5 text-xs text-green-200 hover:bg-green-600 disabled:opacity-50"
                        >
                          加载
                        </button>
                      ) : (
                        <button
                          onClick={() => unloadDataset(ds.name)}
                          className="rounded bg-red-700 px-2 py-0.5 text-xs text-red-200 hover:bg-red-600"
                        >
                          卸载
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
