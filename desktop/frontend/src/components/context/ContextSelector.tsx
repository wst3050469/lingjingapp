// ContextSelector - main shell component for the advanced context selector
// Replaces MentionSelector, shared between Quest and Chat

import { useEffect, useRef, useCallback, useState } from 'react';
import type { MentionType, MentionItem } from '../../types/mention';
import { useContextStore } from '../../stores/context-store';
import { FileSearchPanel } from './FileSearchPanel';
import { FolderTreePanel } from './FolderTreePanel';
import { AttachmentPanel } from './AttachmentPanel';
import { RuleListPanel } from './RuleListPanel';

const MENTION_TYPES: { value: MentionType; label: string; icon: string }[] = [
  { value: 'file', label: 'File', icon: '\u{1F4C4}' },
  { value: 'folder', label: 'Folder', icon: '\u{1F4C1}' },
  { value: 'attachments', label: 'Attachments', icon: '\u{1F4CE}' },
  { value: 'rule', label: 'Rule', icon: '\u{1F4CB}' },
];

interface ContextSelectorProps {
  show: boolean;
  scope: 'quest' | 'chat';
  onDismiss: () => void;
  onSelect: (item: MentionItem) => void;
  searchQuery: string;
  onQueryChange: (query: string) => void;
}

export function ContextSelector({
  show,
  scope,
  onDismiss,
  onSelect,
  searchQuery,
  onQueryChange,
}: ContextSelectorProps) {
  const store = useContextStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectorType = store.selectorType;
  const selectedContexts = scope === 'quest' ? store.questContexts : store.chatContexts;

  // Click outside to close
  useEffect(() => {
    if (!show) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [show, onDismiss]);

  // Focus search input when shown
  useEffect(() => {
    if (show && selectorType !== 'attachments') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show, selectorType]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [store.searchResults, store.recommendedFiles, store.rulesList, selectorType]);

  const handleTypeChange = useCallback((type: MentionType) => {
    store.setSelectorType(type);
    setSelectedIndex(0);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => prev + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onDismiss();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const currentIdx = MENTION_TYPES.findIndex((t) => t.value === selectorType);
      const nextIdx = (currentIdx + 1) % MENTION_TYPES.length;
      handleTypeChange(MENTION_TYPES[nextIdx].value);
    }
  }, [onDismiss, selectorType, handleTypeChange]);

  if (!show) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-cp-panel border border-cp-border rounded-lg shadow-xl overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      {/* Tab bar */}
      <div className="flex gap-1 p-2 border-b border-cp-border/50">
        {MENTION_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => handleTypeChange(type.value)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              selectorType === type.value
                ? 'bg-cp-accent/20 text-cp-accent'
                : 'text-cp-text-dim hover:text-cp-text hover:bg-white/5'
            }`}
          >
            <span>{type.icon}</span>
            <span>@{type.label}</span>
          </button>
        ))}
      </div>

      {/* Search input (hidden for attachments) */}
      {selectorType !== 'attachments' && (
        <div className="p-2 border-b border-cp-border/50">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectorType === 'rule' ? '\u641C\u7D22\u89C4\u5219...' : '\u641C\u7D22\u6587\u4EF6...'}
            className="w-full bg-transparent px-2 py-1.5 text-sm text-cp-text outline-none placeholder:text-cp-text-dim/50"
          />
        </div>
      )}

      {/* Content area */}
      <div className="overflow-y-auto max-h-[280px]">
        {selectorType === 'file' && (
          <FileSearchPanel
            searchQuery={searchQuery}
            selectedIndex={selectedIndex}
            selectedContexts={selectedContexts}
            onSelect={onSelect}
          />
        )}
        {selectorType === 'folder' && (
          <FolderTreePanel
            searchQuery={searchQuery}
            selectedContexts={selectedContexts}
            onSelect={onSelect}
          />
        )}
        {selectorType === 'attachments' && (
          <AttachmentPanel
            scope={scope}
            selectedContexts={selectedContexts}
            onSelect={onSelect}
          />
        )}
        {selectorType === 'rule' && (
          <RuleListPanel
            searchQuery={searchQuery}
            selectedIndex={selectedIndex}
            selectedContexts={selectedContexts}
            onSelect={onSelect}
          />
        )}
      </div>

      {/* Keyboard hints */}
      <div className="px-3 py-1.5 border-t border-cp-border/30 flex gap-3 text-[10px] text-cp-text-dim/40">
        <span>\u2191\u2193 \u5BFC\u822A</span>
        <span>Enter \u9009\u62E9</span>
        <span>Tab \u5207\u6362\u7C7B\u578B</span>
        <span>Esc \u5173\u95ED</span>
      </div>
    </div>
  );
}
