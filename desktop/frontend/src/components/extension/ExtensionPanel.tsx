import { useState, useEffect } from 'react';

interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  installed: boolean;
  category: string;
}

const STORAGE_KEY = 'lingjing-installed-extensions';

const marketplace: Extension[] = [
  { id: 'prettier', name: 'Prettier', description: '代码格式化工具', author: 'Prettier', installed: false, category: '格式化' },
  { id: 'eslint', name: 'ESLint', description: 'JavaScript/TypeScript 代码检查', author: 'ESLint', installed: false, category: '代码检查' },
  { id: 'python', name: 'Python', description: 'Python 语言支持', author: 'Microsoft', installed: false, category: '语言' },
  { id: 'gitlens', name: 'GitLens', description: '增强 Git 功能', author: 'GitKraken', installed: false, category: 'Git' },
  { id: 'docker', name: 'Docker', description: 'Docker 容器管理', author: 'Microsoft', installed: false, category: 'DevOps' },
  { id: 'tailwindcss', name: 'Tailwind CSS', description: 'Tailwind CSS 智能提示', author: 'Tailwind Labs', installed: false, category: '样式' },
  { id: 'copilot', name: 'AI Copilot', description: 'AI 代码补全', author: 'GitHub', installed: false, category: 'AI' },
  { id: 'thunder', name: 'Thunder Client', description: 'REST API 测试工具', author: 'Thunder', installed: false, category: 'API' },
];

function loadInstalledIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function saveInstalledIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

function initExtensions(): Extension[] {
  const installed = loadInstalledIds();
  return marketplace.map(e => ({ ...e, installed: installed.has(e.id) }));
}

export function ExtensionPanel() {
  const [extensions, setExtensions] = useState(initExtensions);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'marketplace' | 'installed'>('marketplace');

  const filtered = extensions.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.description.toLowerCase().includes(search.toLowerCase())
  );

  const installedList = extensions.filter(e => e.installed);

  const toggleInstall = (id: string) => {
    setExtensions(prev => {
      const next = prev.map(e =>
        e.id === id ? { ...e, installed: !e.installed } : e
      );
      const installedIds = new Set(next.filter(e => e.installed).map(e => e.id));
      saveInstalledIds(installedIds);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-cp-text-dim font-medium border-b border-cp-border">
        扩展
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-cp-border">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="在应用商店中搜索扩展"
          className="w-full text-xs bg-cp-bg border border-cp-border rounded px-2 py-1.5 text-cp-text placeholder:text-cp-text-dim/40 focus:border-cp-accent focus:outline-none"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cp-border">
        <button
          onClick={() => setTab('marketplace')}
          className={`flex-1 px-3 py-1.5 text-[10px] uppercase tracking-wider font-medium transition-colors ${
            tab === 'marketplace' ? 'text-cp-text border-b-2 border-cp-accent' : 'text-cp-text-dim/50'
          }`}
        >
          市场
        </button>
        <button
          onClick={() => setTab('installed')}
          className={`flex-1 px-3 py-1.5 text-[10px] uppercase tracking-wider font-medium transition-colors ${
            tab === 'installed' ? 'text-cp-text border-b-2 border-cp-accent' : 'text-cp-text-dim/50'
          }`}
        >
          已安装 ({installedList.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'marketplace' && (
          filtered.length === 0 ? (
            <p className="text-xs text-cp-text-dim/50 text-center py-8">没有找到扩展</p>
          ) : (
            <div className="divide-y divide-cp-border">
              {filtered.map(ext => (
                <div key={ext.id} className="px-3 py-2.5 hover:bg-cp-surfaceHover transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-cp-text font-medium truncate">{ext.name}</span>
                        <span className="text-[9px] text-cp-text-dim/40 bg-cp-bg px-1 rounded">{ext.category}</span>
                      </div>
                      <p className="text-[10px] text-cp-text-dim/60 mt-0.5 line-clamp-1">{ext.description}</p>
                      <p className="text-[9px] text-cp-text-dim/40 mt-0.5">{ext.author}</p>
                    </div>
                    <button
                      onClick={() => toggleInstall(ext.id)}
                      className={`shrink-0 px-2 py-0.5 text-[10px] rounded transition-colors ${
                        ext.installed
                          ? 'bg-cp-error/10 text-cp-error hover:bg-cp-error/20'
                          : 'bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30'
                      }`}
                    >
                      {ext.installed ? '卸载' : '安装'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'installed' && (
          installedList.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-xs text-cp-text-dim/50">未安装任何扩展</p>
              <button onClick={() => setTab('marketplace')} className="text-[10px] text-cp-accent hover:underline">
                浏览市场
              </button>
            </div>
          ) : (
            <div className="divide-y divide-cp-border">
              {installedList.map(ext => (
                <div key={ext.id} className="px-3 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-cp-text font-medium">{ext.name}</span>
                    <p className="text-[10px] text-cp-text-dim/60">{ext.description}</p>
                  </div>
                  <button
                    onClick={() => toggleInstall(ext.id)}
                    className="px-2 py-0.5 text-[10px] bg-cp-error/10 text-cp-error hover:bg-cp-error/20 rounded transition-colors"
                  >
                    卸载
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
