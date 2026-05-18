// FileSearchPanel - displays file search results and recommendations

import type { MentionItem } from '../../types/mention';
import { useContextStore } from '../../stores/context-store';

interface FileSearchPanelProps {
  searchQuery: string;
  selectedIndex: number;
  selectedContexts: MentionItem[];
  onSelect: (item: MentionItem) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  active: '\u5F53\u524D\u6587\u4EF6',
  open: '\u5DF2\u6253\u5F00',
  recent: '\u6700\u8FD1\u7F16\u8F91',
  'git-changed': 'Git \u53D8\u66F4',
};

export function FileSearchPanel({
  searchQuery,
  selectedIndex,
  selectedContexts,
  onSelect,
}: FileSearchPanelProps) {
  const { searchResults, isSearching, recommendedFiles } = useContextStore();

  if (searchQuery) {
    // Show search results
    return (
      <div className="p-2">
        <div className="px-2 py-1.5 text-xs text-cp-text-dim/60 uppercase tracking-wider">
          {'\u641C\u7D22\u7ED3\u679C'}
        </div>
        {isSearching && (
          <div className="px-3 py-4 text-sm text-cp-text-dim/60 text-center flex items-center justify-center gap-2">
            <span className="w-3 h-3 border-2 border-cp-accent border-t-transparent rounded-full animate-spin" />
            {'\u641C\u7D22\u4E2D...'}
          </div>
        )}
        {!isSearching && searchResults.length === 0 && (
          <div className="px-3 py-4 text-sm text-cp-text-dim/60 text-center">
            {'\u672A\u627E\u5230\u5339\u914D\u7684\u6587\u4EF6'}
          </div>
        )}
        {!isSearching && searchResults.map((item, index) => {
          const isSelected = selectedContexts.some((c) => c.path === item.path);
          return (
            <button
              key={item.id}
              onClick={() => !isSelected && onSelect(item)}
              className={`w-full px-3 py-2 text-left rounded transition-colors ${
                index === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
              } ${isSelected ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{'\u{1F4C4}'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-cp-text truncate">
                    {highlightMatch(item.label, searchQuery)}
                  </div>
                  <div className="text-xs text-cp-text-dim/60 truncate">{item.path}</div>
                </div>
                {item.size != null && (
                  <span className="text-[10px] text-cp-text-dim/40 shrink-0">
                    {formatSize(item.size)}
                  </span>
                )}
                {isSelected && <span className="text-xs text-cp-accent shrink-0">{'\u2713'}</span>}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Show recommended files grouped by source
  const groups = groupBySource(recommendedFiles);

  return (
    <div className="p-2">
      {groups.length === 0 && (
        <div className="px-3 py-4 text-sm text-cp-text-dim/60 text-center">
          {'\u8F93\u5165\u5173\u952E\u8BCD\u641C\u7D22\u6587\u4EF6'}
        </div>
      )}
      {groups.map(([source, items]) => (
        <div key={source}>
          <div className="px-2 py-1.5 text-xs text-cp-text-dim/60 uppercase tracking-wider">
            {SOURCE_LABELS[source] || source}
          </div>
          {items.map((item, index) => {
            const isSelected = selectedContexts.some((c) => c.path === item.path);
            return (
              <button
                key={item.id}
                onClick={() => !isSelected && onSelect(item)}
                className={`w-full px-3 py-2 text-left rounded transition-colors hover:bg-white/5 ${
                  isSelected ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{'\u{1F4C4}'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-cp-text truncate">{item.label}</div>
                    <div className="text-xs text-cp-text-dim/60 truncate">{item.path}</div>
                  </div>
                  {isSelected && <span className="text-xs text-cp-accent shrink-0">{'\u2713'}</span>}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function groupBySource(items: MentionItem[]): [string, MentionItem[]][] {
  const groups = new Map<string, MentionItem[]>();
  for (const item of items) {
    const source = item.source || 'open';
    if (!groups.has(source)) groups.set(source, []);
    groups.get(source)!.push(item);
  }
  return Array.from(groups.entries());
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <span className="text-cp-accent font-medium">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}
