import React, { useState, useEffect, useCallback } from 'react';

interface VectorItem {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}

export const VectorMemoryPanel: React.FC = () => {
  const [items, setItems] = useState<VectorItem[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<VectorItem | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const results = await window.electronAPI?.invoke('fusion:vector:search', query, 10) as VectorItem[];
      setItems(results ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    handleSearch();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">向量记忆</h2>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入语义搜索查询..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          搜索
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelected(item)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selected?.id === item.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.id}</div>
              <div className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{item.content}</div>
              <div className="text-xs text-gray-400 mt-1">相似度: {item.score.toFixed(3)}</div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">记忆详情</h3>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">ID: {selected.id}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">相似度: {selected.score.toFixed(3)}</div>
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selected.content}</div>
          </div>
        )}
      </div>
    </div>
  );
};
