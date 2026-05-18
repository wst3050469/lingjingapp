// RuleListPanel - displays and filters available rules for @rule selection

import { useEffect, useState } from 'react';
import type { MentionItem } from '../../types/mention';
import { useContextStore } from '../../stores/context-store';

interface RuleListPanelProps {
  searchQuery: string;
  selectedIndex: number;
  selectedContexts: MentionItem[];
  onSelect: (item: MentionItem) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  config: '\u914D\u7F6E\u89C4\u5219',
  file: '\u6587\u4EF6\u89C4\u5219 (.qoder/rules/)',
  'agents-md': 'AGENTS.md',
};

const TYPE_COLORS: Record<string, string> = {
  always: 'bg-green-500/20 text-green-400',
  model: 'bg-blue-500/20 text-blue-400',
  manual: 'bg-amber-500/20 text-amber-400',
  filePattern: 'bg-purple-500/20 text-purple-400',
};

export function RuleListPanel({
  searchQuery,
  selectedIndex,
  selectedContexts,
  onSelect,
}: RuleListPanelProps) {
  const { rulesList, rulesLoaded, loadRules } = useContextStore();

  useEffect(() => {
    if (!rulesLoaded) {
      loadRules();
    }
  }, [rulesLoaded]);

  // Filter rules by search query
  const filteredRules = searchQuery
    ? rulesList.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rulesList;

  // Group by source
  const groups = new Map<string, typeof filteredRules>();
  for (const rule of filteredRules) {
    const source = rule.source || 'config';
    if (!groups.has(source)) groups.set(source, []);
    groups.get(source)!.push(rule);
  }

  if (!rulesLoaded) {
    return (
      <div className="px-3 py-4 text-sm text-cp-text-dim/60 text-center flex items-center justify-center gap-2">
        <span className="w-3 h-3 border-2 border-cp-accent border-t-transparent rounded-full animate-spin" />
        {'\u52A0\u8F7D\u89C4\u5219\u4E2D...'}
      </div>
    );
  }

  if (filteredRules.length === 0) {
    return <EmptyRulesState searchQuery={searchQuery} onCreated={() => loadRules()} />;
  }

let globalIdx = 0;

  return (
    <div className="p-2">
      {Array.from(groups.entries()).map(([source, rules]) => (
        <div key={source}>
          <div className="px-2 py-1.5 text-xs text-cp-text-dim/60 uppercase tracking-wider">
            {SOURCE_LABELS[source] || source}
          </div>
          {rules.map((rule) => {
            const currentIdx = globalIdx++;
            const isSelected = selectedContexts.some((c) => c.path === rule.filePath);
            return (
              <button
                key={rule.id}
                onClick={() => {
                  if (isSelected) return;
                  onSelect({
                    id: `rule-${rule.id}-${Date.now()}`,
                    type: 'rule',
                    label: rule.name,
                    path: rule.filePath || rule.name,
                    icon: 'rule',
                  });
                }}
                className={`w-full px-3 py-2 text-left rounded transition-colors ${
                  currentIdx === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
                } ${isSelected ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{'\u{1F4CB}'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-cp-text truncate">
                        {highlightMatch(rule.name, searchQuery)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${TYPE_COLORS[rule.type] || 'bg-white/10 text-cp-text-dim'}`}>
                        {rule.type}
                      </span>
                    </div>
                    {rule.description && (
                      <div className="text-xs text-cp-text-dim/60 truncate mt-0.5">
                        {rule.description}
                      </div>
                    )}
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

/** Empty state with quick-create rule button */
function EmptyRulesState({ searchQuery, onCreated }: {
  searchQuery: string;
  onCreated: () => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [content_, setContent_] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !content_.trim()) return;
    setSaving(true);
    try {
      await window.electronAPI.context.createRule(name.trim(), content_.trim());
      setName('');
      setContent_('');
      setIsCreating(false);
      onCreated();
    } catch (err) {
      console.error('Failed to create rule:', err);
    } finally {
      setSaving(false);
    }
  };

  if (isCreating) {
    return (
      <div className="px-3 py-3 space-y-3">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="规则名称（如 coding-style）"
          className="w-full bg-white/5 border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent/50"
          autoFocus
        />
        <textarea
          value={content_}
          onChange={e => setContent_(e.target.value)}
          placeholder="规则内容（Markdown 格式）"
          rows={4}
          className="w-full bg-white/5 border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent/50 resize-none"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim() || !content_.trim()}
            className="text-xs px-3 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 disabled:opacity-30 transition-colors"
          >
            {saving ? '创建中...' : '创建规则'}
          </button>
          <button
            onClick={() => setIsCreating(false)}
            className="text-xs px-3 py-1.5 rounded-md text-cp-text-dim hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 text-center">
      <p className="text-sm text-cp-text-dim/60 mb-3">
        {searchQuery ? '未找到匹配的规则' : '暂无可用规则'}
      </p>
      <button
        onClick={() => setIsCreating(true)}
        className="text-xs px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:text-white hover:bg-white/10 transition-colors"
      >
        + 创建新规则
      </button>
    </div>
  );
}
