import { useState } from 'react';

export function SearchPanel() {
  const [query, setQuery] = useState('');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-cp-text-dim font-medium border-b border-cp-border">
        搜索
      </div>

      {/* Search input */}
      <div className="px-3 py-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索文件内容..."
          className="w-full bg-cp-bg border border-cp-border rounded px-2.5 py-1.5 text-xs text-cp-text outline-none
            focus:border-cp-accent placeholder:text-cp-text-dim/40"
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-xs text-cp-text-dim/40 text-center">
          {query ? '搜索功能开发中...' : '输入关键词搜索工作区中的文件'}
        </p>
      </div>
    </div>
  );
}
