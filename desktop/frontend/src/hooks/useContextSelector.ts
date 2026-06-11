// useContextSelector - hook for integrating the advanced context selector
// Wraps context-store with @ detection and text manipulation logic

import { useCallback, useEffect } from 'react';
import { useContextStore } from '../stores/context-store';
import type { MentionItem, MentionDetection, MentionPosition } from '../types/mention';

type ContextScope = 'quest' | 'chat';

export function useContextSelector(scope: ContextScope) {
  const store = useContextStore();

  const selectedContexts = scope === 'quest' ? store.questContexts : store.chatContexts;

  // Load recommendations on mount
  useEffect(() => {
    store.loadRecommendations();
  }, []);

  // Detect @ mention in text at cursor position
  const detectMention = useCallback((text: string, cursorPosition: number): MentionDetection => {
    const textBeforeCursor = text.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) {
      return { show: false, query: '', position: { top: 0, left: 0 }, triggerIndex: -1 };
    }

    // Check if there's a space after @
    const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
      return { show: false, query: '', position: { top: 0, left: 0 }, triggerIndex: -1 };
    }

    const query = textAfterAt;

    // Approximate popup position
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLine = lines[currentLineIndex];

    return {
      show: true,
      query,
      position: {
        top: currentLineIndex * 20 + 40,
        left: currentLine.length * 8,
      },
      triggerIndex: lastAtIndex,
    };
  }, []);

  // Handle text change - detect @ and trigger search
  const handleTextChange = useCallback((text: string, cursorPosition: number) => {
    const detection = detectMention(text, cursorPosition);

    if (detection.show) {
      if (!store.showSelector || store.activeScope !== scope) {
        store.openSelector(scope);
      }
      store.setSearchQuery(detection.query);
    } else if (store.showSelector && store.activeScope === scope) {
      store.closeSelector();
    }
  }, [scope, store.showSelector, store.activeScope]);

  // Handle item selection - replace @query text and add to contexts
  const handleSelect = useCallback((
    item: MentionItem,
    text: string,
    setText: (text: string) => void,
  ) => {
    // Find the @ trigger in text and replace @query with empty string
    const { searchQuery } = store;
    const atPattern = `@${searchQuery}`;
    const lastIndex = text.lastIndexOf(atPattern);

    if (lastIndex !== -1) {
      const newText = text.slice(0, lastIndex) + text.slice(lastIndex + atPattern.length);
      setText(newText.trimEnd() ? newText : newText.trim());
    }

    store.selectContext(scope, item);
    store.closeSelector();
  }, [scope, store.searchQuery]);

  // Open selector via toolbar button (no @ in text)
  const openViaButton = useCallback((type?: MentionItem['type']) => {
    store.openSelector(scope, type || 'file');
    store.loadRecommendations();
  }, [scope]);

  // Dismiss the selector
  const dismissSelector = useCallback(() => {
    if (store.activeScope === scope) {
      store.closeSelector();
    }
  }, [scope]);

  return {
    // State
    showSelector: store.showSelector && store.activeScope === scope,
    selectorType: store.selectorType,
    searchQuery: store.searchQuery,
    searchResults: store.searchResults,
    isSearching: store.isSearching,
    recommendedFiles: store.recommendedFiles,
    rulesList: store.rulesList,
    folderTree: store.folderTree,
    expandedFolders: store.expandedFolders,
    selectedContexts,

    // Actions
    detectMention,
    handleTextChange,
    handleSelect,
    openViaButton,
    dismissSelector,
    setSelectorType: store.setSelectorType,
    setSearchQuery: store.setSearchQuery,
    selectContext: (item: MentionItem) => store.selectContext(scope, item),
    removeContext: (id: string) => store.removeContext(scope, id),
    clearContexts: () => store.clearContexts(scope),
    loadRecommendations: store.loadRecommendations,
    loadRules: store.loadRules,
    loadFolderTree: store.loadFolderTree,
    toggleFolder: store.toggleFolder,
  };
}
