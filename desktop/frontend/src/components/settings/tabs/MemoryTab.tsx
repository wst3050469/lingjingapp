import { useState, useEffect, useMemo } from 'react';

/* --- Types --- */

interface Memory {
  id: string;
  scope: 'global' | 'project';
  project_path: string | null;
  category: string;
  title: string;
  content: string;
  source: 'active' | 'automatic';
  created_at: string;
  updated_at: string;
}

type ScopeFilter = 'all' | 'global' | 'project';

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  general: { label: '通用', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
  preference: { label: '偏好', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  project: { label: '项目', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  workflow: { label: '工作流', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  issue: { label: '问题', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  knowledge: { label: '知识', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
};

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  active: { label: '主动保存', icon: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z' },
  automatic: { label: '自动学习', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z' },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

/* --- Helper components --- */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-green-500' : 'bg-white/10'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

/* --- Types --- */

interface MemoryTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

/* --- Component --- */

export function MemoryTab({ config, saveKey }: MemoryTabProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [autoMemory, setAutoMemory] = useState<boolean>(config?.autoMemory ?? false);

  // Add form state
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newScope, setNewScope] = useState<'global' | 'project'>('global');

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI.memory.list();
      setMemories(list || []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMemories();
      return;
    }
    setLoading(true);
    try {
      const scopeVal = scopeFilter === 'all' ? undefined : scopeFilter;
      const results = await window.electronAPI.memory.search(searchQuery, scopeVal);
      setMemories(results || []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await window.electronAPI.memory.delete(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleClearAll = async () => {
    const scopeVal = scopeFilter === 'all' ? undefined : scopeFilter;
    await window.electronAPI.memory.clear(scopeVal ? { scope: scopeVal } : undefined);
    setConfirmClear(false);
    loadMemories();
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    await window.electronAPI.memory.add({
      scope: newScope,
      category: newCategory,
      title: newTitle.trim(),
      content: newContent.trim(),
      source: 'active',
    });
    resetAddForm();
    loadMemories();
  };

  const resetAddForm = () => {
    setShowAddForm(false);
    setNewTitle('');
    setNewContent('');
    setNewCategory('general');
    setNewScope('global');
  };

  // Filtered memories
  const filtered = useMemo(() => {
    let list = memories;
    if (scopeFilter !== 'all') {
      list = list.filter((m) => m.scope === scopeFilter);
    }
    if (categoryFilter !== 'all') {
      list = list.filter((m) => m.category === categoryFilter);
    }
    return list;
  }, [memories, scopeFilter, categoryFilter]);

  const globalCount = memories.filter((m) => m.scope === 'global').length;
  const projectCount = memories.filter((m) => m.scope === 'project').length;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'Z');
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return '今天';
      if (days === 1) return '昨天';
      if (days < 7) return `${days}天前`;
      if (days < 30) return `${Math.floor(days / 7)}周前`;
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header description */}
      <div>
        <p className="text-[11px] text-cp-text-dim/50 leading-relaxed">
          灵境会在对话过程中学习并记住你的偏好、项目细节和工作方式。记忆分为<span className="text-cp-text-dim/70">全局记忆</span>(跨项目生效)和<span className="text-cp-text-dim/70">项目记忆</span>(仅特定项目生效)。你可以在此查看、搜索和管理所有记忆。
        </p>
      </div>

      {/* Auto memory toggle */}
      <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 mr-4">
            <p className="text-sm text-cp-text">自动记忆</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-0.5">根据对话内容自动学习你的偏好、项目细节和工作方式</p>
          </div>
          <Toggle
            checked={autoMemory}
            onChange={(v) => {
              setAutoMemory(v);
              saveKey('autoMemory', v);
            }}
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500/50" />
            <span className="text-[11px] text-cp-text-dim/50">全局 <span className="text-cp-text/70 font-medium">{globalCount}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500/50" />
            <span className="text-[11px] text-cp-text-dim/50">项目 <span className="text-cp-text/70 font-medium">{projectCount}</span></span>
          </div>
          <span className="text-[11px] text-cp-text-dim/30">共 {memories.length} 条</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            添加
          </button>
          {memories.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-xs px-3 py-1.5 rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* Confirm clear dialog */}
      {confirmClear && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <p className="text-xs text-red-400 mb-3">
            确定要清除{scopeFilter === 'all' ? '所有' : scopeFilter === 'global' ? '全局' : '项目'}记忆吗？此操作不可撤销。
          </p>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setConfirmClear(false)} className="text-xs text-cp-text-dim hover:text-cp-text px-3 py-1.5">
              取消
            </button>
            <button
              onClick={handleClearAll}
              className="text-xs px-4 py-1.5 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/30 transition-colors"
            >
              确认清除
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white/[0.03] border border-cp-accent/30 rounded-xl p-4 space-y-3">
          <p className="text-xs text-cp-text font-medium">添加记忆</p>

          {/* Title */}
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="记忆标题 (例: 偏好使用 TypeScript 严格模式)"
            className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            autoFocus
          />

          {/* Scope + Category row */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-cp-text-dim/50">范围</label>
              <div className="flex gap-1">
                {(['global', 'project'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setNewScope(s)}
                    className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                      newScope === s
                        ? s === 'global'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'border-cp-border/30 text-cp-text-dim/50 hover:border-cp-border/50'
                    }`}
                  >
                    {s === 'global' ? '全局' : '项目'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-4">
              <label className="text-[11px] text-cp-text-dim/50">分类</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="bg-cp-bg border border-cp-border/50 rounded-lg px-2 py-0.5 text-[11px] text-cp-text outline-none focus:border-cp-accent"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Content */}
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="记忆内容..."
            rows={4}
            className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent resize-none leading-relaxed"
          />

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button onClick={resetAddForm} className="text-xs text-cp-text-dim hover:text-cp-text px-3 py-1.5">
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || !newContent.trim()}
              className="text-xs px-4 py-1.5 bg-cp-accent text-cp-text rounded-md hover:bg-cp-accent/80 disabled:opacity-50 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cp-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索记忆..."
              className="w-full bg-white/[0.03] border border-cp-border/40 rounded-lg pl-9 pr-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent placeholder:text-cp-text-dim/30"
            />
          </div>
          <button
            onClick={handleSearch}
            className="text-xs px-3 py-1.5 rounded-md bg-white/[0.05] text-cp-text-dim hover:text-cp-text hover:bg-white/10 transition-colors"
          >
            搜索
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-4">
          {/* Scope filter */}
          <div className="flex items-center gap-1">
            {(['all', 'global', 'project'] as ScopeFilter[]).map((scope) => (
              <button
                key={scope}
                onClick={() => setScopeFilter(scope)}
                className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                  scopeFilter === scope
                    ? 'bg-cp-surface text-cp-text'
                    : 'text-cp-text-dim/40 hover:text-cp-text-dim/70'
                }`}
              >
                {scope === 'all' ? '全部' : scope === 'global' ? '全局' : '项目'}
              </button>
            ))}
          </div>

          <div className="w-px h-3.5 bg-cp-border/30" />

          {/* Category filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-cp-surface text-cp-text'
                  : 'text-cp-text-dim/40 hover:text-cp-text-dim/70'
              }`}
            >
              全部
            </button>
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                  categoryFilter === cat
                    ? 'bg-cp-surface text-cp-text'
                    : 'text-cp-text-dim/40 hover:text-cp-text-dim/70'
                }`}
              >
                {CATEGORY_LABELS[cat].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Memory list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-cp-accent/30 border-t-cp-accent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-cp-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <p className="text-sm text-cp-text-dim/50 mb-1">
            {searchQuery ? '没有找到匹配的记忆' : '暂无记忆'}
          </p>
          <p className="text-[11px] text-cp-text-dim/30">
            {searchQuery ? '尝试调整搜索关键词或筛选条件' : '在对话中使用 "记住..." 来让灵境学习你的偏好'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((mem) => {
            const isExpanded = expandedId === mem.id;
            const catInfo = CATEGORY_LABELS[mem.category] || CATEGORY_LABELS.general;
            const sourceInfo = SOURCE_LABELS[mem.source] || SOURCE_LABELS.active;

            return (
              <div
                key={mem.id}
                className={`bg-white/[0.03] border rounded-xl overflow-hidden transition-colors ${
                  isExpanded ? 'border-cp-accent/30' : 'border-cp-border/40'
                }`}
              >
                {/* Memory header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : mem.id)}
                >
                  {/* Scope dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    mem.scope === 'global' ? 'bg-blue-500/60' : 'bg-green-500/60'
                  }`} title={mem.scope === 'global' ? '全局' : '项目'} />

                  {/* Title + badges */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm text-cp-text truncate">{mem.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${catInfo.color}`}>
                      {catInfo.label}
                    </span>
                  </div>

                  {/* Source + date */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-cp-text-dim/30" title={sourceInfo.label}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={sourceInfo.icon} />
                      </svg>
                    </div>
                    <span className="text-[10px] text-cp-text-dim/30">{formatDate(mem.created_at)}</span>
                    {/* Expand chevron */}
                    <svg className={`w-3.5 h-3.5 text-cp-text-dim/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {/* Content preview (collapsed) */}
                {!isExpanded && (
                  <div className="px-4 pb-3">
                    <p className="text-[11px] text-cp-text-dim/40 line-clamp-1 leading-relaxed">{mem.content}</p>
                  </div>
                )}

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-cp-border/20 pt-3 space-y-3">
                    {/* Full content */}
                    <div className="bg-cp-bg/50 rounded-lg p-3">
                      <p className="text-xs text-cp-text-dim/70 leading-relaxed whitespace-pre-wrap">{mem.content}</p>
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[10px] text-cp-text-dim/30">
                        <span>{mem.scope === 'global' ? '全局' : '项目'}{mem.project_path ? ` - ${mem.project_path}` : ''}</span>
                        <span>{sourceInfo.label}</span>
                        <span>{mem.created_at}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(mem.id); }}
                        className="flex items-center gap-1 text-[11px] text-red-400/50 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info card */}
      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
        <p className="text-xs text-cp-text-dim/50 font-medium mb-3">记忆说明</p>
        <div className="space-y-2">
          {[
            { icon: SOURCE_LABELS.active.icon, title: '主动记忆', desc: '在对话中使用 "记住这个偏好" 等语句，灵境会主动保存为长期记忆' },
            { icon: SOURCE_LABELS.automatic.icon, title: '自动记忆', desc: '灵境从对话上下文中自动学习你的编码偏好、项目规范和常见模式' },
            { icon: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418', title: '全局 vs 项目', desc: '全局记忆跨所有项目生效，项目记忆仅对特定工作区有效' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-start gap-2">
              <svg className="w-4 h-4 text-cp-text-dim/30 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              <div>
                <span className="text-[11px] text-cp-text-dim/60 font-medium">{title}</span>
                <span className="text-[11px] text-cp-text-dim/40 ml-1.5">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
