// WikiTOC - table of contents navigation for wiki modules

import { useWikiStore } from '../../stores/wiki-store';

export function WikiTOC() {
  const { toc, hasOverview, selectedModule, changedModules, selectModule } = useWikiStore();

  const changedSet = new Set(changedModules);

  if (toc.length === 0 && !hasOverview) {
    return (
      <div className="p-3 text-center">
        <p className="text-xs text-cp-text-dim/40">暂无文档</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-cp-border/20 shrink-0">
        <span className="text-[10px] font-medium text-cp-text-dim/50 uppercase tracking-wider">目录</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-1">
        {/* Overview entry */}
        {hasOverview && (
          <button
            onClick={() => selectModule('overview')}
            className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
              selectedModule === 'overview'
                ? 'bg-cp-accent/10 text-cp-accent'
                : 'text-cp-text-dim hover:bg-white/5 hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="font-medium">项目总览</span>
          </button>
        )}

        {/* Module entries */}
        {toc.map((entry) => {
          const isActive = selectedModule === entry.path;
          const hasChange = changedSet.has(entry.path);

          return (
            <button
              key={entry.path}
              onClick={() => selectModule(entry.path)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                isActive
                  ? 'bg-cp-accent/10 text-cp-accent'
                  : 'text-cp-text-dim hover:bg-white/5 hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{entry.title}</span>
                  {hasChange && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="有变更" />
                  )}
                </div>
                <span className="text-[10px] text-cp-text-dim/40 truncate block">{entry.path}</span>
              </div>
              <span className="text-[10px] text-cp-text-dim/30 shrink-0">{entry.fileCount}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
