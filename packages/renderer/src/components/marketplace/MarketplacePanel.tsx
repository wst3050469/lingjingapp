import React, { useState, useEffect } from 'react';
import { useMarketplaceStore } from '../../stores/marketplace-store';

export function MarketplacePanel() {
  const { searchResults, loading, search, install, uninstall, rate } = useMarketplaceStore();
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<'browse' | 'installed'>('browse');

  useEffect(() => {
    search('');
  }, []);

  const categories = [
    { key: '', label: '全部' },
    { key: 'code_generation', label: '代码生成' },
    { key: 'testing', label: '测试' },
    { key: 'review', label: '审查' },
    { key: 'deployment', label: '部署' },
    { key: 'custom', label: '自定义' },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-200">技能市场</h2>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setActiveTab('browse')} className={`rounded px-3 py-1 text-xs ${activeTab === 'browse' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            浏览
          </button>
          <button onClick={() => setActiveTab('installed')} className={`rounded px-3 py-1 text-xs ${activeTab === 'installed' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            已安装
          </button>
        </div>
      </div>

      <div className="border-b border-gray-700 px-4 py-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search(keyword)}
            placeholder="搜索技能..."
            className="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button onClick={() => search(keyword)} disabled={loading} className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-50">
            搜索
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {searchResults.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            {activeTab === 'browse' ? '搜索或浏览技能' : '暂无已安装技能'}
          </p>
        ) : (
          <div className="space-y-2">
            {searchResults.map((skill: any) => (
              <div key={skill.id} className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{skill.name}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{skill.category} · v{skill.version} · ⭐ {skill.rating?.toFixed(1)}</p>
                  </div>
                  <button onClick={() => install(skill.id)} className="rounded bg-green-600/20 px-2 py-0.5 text-xs text-green-400 hover:bg-green-600/30">
                    安装
                  </button>
                </div>
                {skill.description && <p className="mt-1 text-xs text-gray-400 line-clamp-2">{skill.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}