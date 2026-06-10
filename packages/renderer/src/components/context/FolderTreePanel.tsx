// FolderTreePanel - tree-based folder browser for @folder selection

import { useEffect } from 'react';
import type { MentionItem, FolderTreeNode } from '../../types/mention';
import { useContextStore } from '../../stores/context-store';

interface FolderTreePanelProps {
  searchQuery: string;
  selectedContexts: MentionItem[];
  onSelect: (item: MentionItem) => void;
}

export function FolderTreePanel({
  searchQuery,
  selectedContexts,
  onSelect,
}: FolderTreePanelProps) {
  const { folderTree, expandedFolders, searchResults, isSearching } = useContextStore();
  const { loadFolderTree, toggleFolder } = useContextStore();

  useEffect(() => {
    if (folderTree.length === 0) {
      loadFolderTree();
    }
  }, []);

  // If there's a search query, show search results for folders
  if (searchQuery) {
    return (
      <div className="p-2">
        <div className="px-2 py-1.5 text-xs text-cp-text-dim/60 uppercase tracking-wider">
          {'\u6587\u4EF6\u5939\u641C\u7D22\u7ED3\u679C'}
        </div>
        {isSearching && (
          <div className="px-3 py-4 text-sm text-cp-text-dim/60 text-center flex items-center justify-center gap-2">
            <span className="w-3 h-3 border-2 border-cp-accent border-t-transparent rounded-full animate-spin" />
            {'\u641C\u7D22\u4E2D...'}
          </div>
        )}
        {!isSearching && searchResults.length === 0 && (
          <div className="px-3 py-4 text-sm text-cp-text-dim/60 text-center">
            {'\u672A\u627E\u5230\u5339\u914D\u7684\u6587\u4EF6\u5939'}
          </div>
        )}
        {!isSearching && searchResults.filter((r) => r.type === 'folder').map((item) => {
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
                <span className="text-sm">{'\u{1F4C1}'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-cp-text truncate">{item.label}</div>
                  <div className="text-xs text-cp-text-dim/60 truncate">{item.path}</div>
                </div>
                {isSelected && <span className="text-xs text-cp-accent">{'\u2713'}</span>}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Show folder tree
  return (
    <div className="p-2">
      <div className="px-2 py-1.5 text-xs text-cp-text-dim/60 uppercase tracking-wider">
        {'\u5DE5\u4F5C\u533A\u76EE\u5F55'}
      </div>
      {folderTree.length === 0 && (
        <div className="px-3 py-4 text-sm text-cp-text-dim/60 text-center">
          {'\u6B63\u5728\u52A0\u8F7D\u76EE\u5F55\u6811...'}
        </div>
      )}
      {folderTree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          expandedFolders={expandedFolders}
          selectedContexts={selectedContexts}
          onToggle={toggleFolder}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  expandedFolders,
  selectedContexts,
  onToggle,
  onSelect,
}: {
  node: FolderTreeNode;
  depth: number;
  expandedFolders: Set<string>;
  selectedContexts: MentionItem[];
  onToggle: (path: string) => void;
  onSelect: (item: MentionItem) => void;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedContexts.some((c) => c.path === node.path);

  const handleSelect = () => {
    if (isSelected) return;
    onSelect({
      id: `folder-${node.path}-${Date.now()}`,
      type: 'folder',
      label: node.name,
      path: node.path,
      icon: 'folder',
    });
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 rounded transition-colors hover:bg-white/5 ${
          isSelected ? 'opacity-40' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(node.path); }}
          className="w-4 h-4 flex items-center justify-center text-cp-text-dim/60 hover:text-cp-text shrink-0"
        >
          <span className="text-[10px]">{isExpanded ? '\u25BE' : '\u25B8'}</span>
        </button>

        {/* Folder name - click to select */}
        <button
          onClick={handleSelect}
          className="flex-1 flex items-center gap-1.5 text-left min-w-0"
          disabled={isSelected}
        >
          <span className="text-sm shrink-0">{'\u{1F4C1}'}</span>
          <span className="text-sm text-cp-text truncate">{node.name}</span>
          {isSelected && <span className="text-xs text-cp-accent ml-auto shrink-0">{'\u2713'}</span>}
        </button>
      </div>

      {/* Children */}
      {isExpanded && node.children && node.children.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          expandedFolders={expandedFolders}
          selectedContexts={selectedContexts}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
