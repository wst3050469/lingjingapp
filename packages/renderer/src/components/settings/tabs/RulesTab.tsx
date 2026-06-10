import { useState, useMemo } from 'react';

/* --- Types --- */

type RuleType = 'manual' | 'model' | 'always' | 'filePattern';

interface Rule {
  id: string;
  name: string;
  type: RuleType;
  content: string;
  description?: string;
  filePatterns?: string;
  enabled: boolean;
}

interface RulesTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  manual: '手动引入',
  model: '模型决策',
  always: '始终生效',
  filePattern: '指定文件生效',
};

const RULE_TYPE_COLORS: Record<RuleType, { bg: string; text: string; border: string }> = {
  manual: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  model: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  always: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  filePattern: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
};

const MAX_TOTAL_CHARS = 100000;

/* --- Main Component --- */

export function RulesTab({ config, saveKey }: RulesTabProps) {
  const rules: Rule[] = useMemo(() => {
    const raw = config?.rules;
    return Array.isArray(raw) ? raw : [];
  }, [config?.rules]);

  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<RuleType>('always');
  const [newContent, setNewContent] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFilePatterns, setNewFilePatterns] = useState('');

  const totalChars = rules.reduce((sum, r) => sum + r.content.length, 0);

  const saveRules = (updated: Rule[]) => {
    saveKey('rules', updated);
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const rule: Rule = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: newName.trim(),
      type: newType,
      content: newContent,
      enabled: true,
      ...(newType === 'model' && newDescription ? { description: newDescription } : {}),
      ...(newType === 'filePattern' && newFilePatterns ? { filePatterns: newFilePatterns } : {}),
    };
    saveRules([...rules, rule]);
    resetAddForm();
  };

  const resetAddForm = () => {
    setShowAddForm(false);
    setNewName('');
    setNewType('always');
    setNewContent('');
    setNewDescription('');
    setNewFilePatterns('');
  };

  const handleDelete = (id: string) => {
    saveRules(rules.filter((r) => r.id !== id));
    if (editingRule?.id === id) setEditingRule(null);
  };

  const handleToggle = (id: string) => {
    saveRules(rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleSaveEdit = () => {
    if (!editingRule) return;
    saveRules(rules.map((r) => r.id === editingRule.id ? editingRule : r));
    setEditingRule(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[11px] text-cp-text-dim/50 leading-relaxed">
              为项目配置专属规则，存放于 <code className="text-cp-text-dim/70 bg-white/[0.04] px-1 rounded">.qoder/rules/</code> 目录中，或添加 <code className="text-cp-text-dim/70 bg-white/[0.04] px-1 rounded">AGENTS.md</code> 文件。规则优先级高于记忆。
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors shrink-0 ml-4"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            添加
          </button>
        </div>
        {/* Char count bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${totalChars > MAX_TOTAL_CHARS * 0.9 ? 'bg-red-500' : 'bg-cp-accent/50'}`}
              style={{ width: `${Math.min((totalChars / MAX_TOTAL_CHARS) * 100, 100)}%` }}
            />
          </div>
          <span className={`text-[10px] shrink-0 ${totalChars > MAX_TOTAL_CHARS ? 'text-red-400' : 'text-cp-text-dim/40'}`}>
            {totalChars.toLocaleString()} / {MAX_TOTAL_CHARS.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white/[0.03] border border-cp-accent/30 rounded-xl p-4 space-y-3">
          <p className="text-xs text-cp-text font-medium">添加规则</p>

          {/* Name */}
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="规则名称"
            className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            autoFocus
          />

          {/* Type selector */}
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map((type) => {
              const c = RULE_TYPE_COLORS[type];
              return (
                <button
                  key={type}
                  onClick={() => setNewType(type)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                    newType === type
                      ? `${c.bg} ${c.text} ${c.border}`
                      : 'border-cp-border/30 text-cp-text-dim/50 hover:border-cp-border/50'
                  }`}
                >
                  {RULE_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>

          {/* Type-specific fields */}
          {newType === 'model' && (
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="场景描述 (例: 生成一个单元测试)"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          )}
          {newType === 'filePattern' && (
            <input
              type="text"
              value={newFilePatterns}
              onChange={(e) => setNewFilePatterns(e.target.value)}
              placeholder="文件通配符 (逗号分隔, 例: *.ts, src/**/*.tsx)"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
            />
          )}

          {/* Content */}
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="规则内容 (自然语言描述)"
            rows={6}
            className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text font-mono outline-none focus:border-cp-accent resize-none leading-relaxed"
          />

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button onClick={resetAddForm} className="text-xs text-cp-text-dim hover:text-cp-text px-3 py-1.5">
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="text-xs px-4 py-1.5 bg-cp-accent text-cp-text rounded-md hover:bg-cp-accent/80 disabled:opacity-50 transition-colors"
            >
              确认
            </button>
          </div>
        </div>
      )}

      {/* Rule list */}
      {rules.length === 0 && !showAddForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-cp-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-sm text-cp-text-dim/50 mb-1">暂无规则</p>
          <p className="text-[11px] text-cp-text-dim/30 mb-4">添加规则以优化 AI 对你项目的适配</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs px-4 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
          >
            添加第一条规则
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const c = RULE_TYPE_COLORS[rule.type];
            const isEditing = editingRule?.id === rule.id;
            return (
              <div key={rule.id} className={`bg-white/[0.03] border rounded-xl overflow-hidden transition-colors ${isEditing ? 'border-cp-accent/40' : 'border-cp-border/40'}`}>
                {/* Rule header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(rule.id)}
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0 ${
                      rule.enabled ? 'bg-green-500' : 'bg-white/10'
                    }`}
                  >
                    <span className={`inline-block h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${
                      rule.enabled ? 'translate-x-[14px]' : 'translate-x-[3px]'
                    }`} />
                  </button>

                  {/* Name + type badge */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-sm font-medium truncate ${rule.enabled ? 'text-cp-text' : 'text-cp-text-dim/40'}`}>
                      {rule.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${c.bg} ${c.text} ${c.border}`}>
                      {RULE_TYPE_LABELS[rule.type]}
                    </span>
                    {rule.type === 'filePattern' && rule.filePatterns && (
                      <span className="text-[10px] text-cp-text-dim/40 font-mono truncate">{rule.filePatterns}</span>
                    )}
                    {rule.type === 'model' && rule.description && (
                      <span className="text-[10px] text-cp-text-dim/40 truncate">{rule.description}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingRule(isEditing ? null : { ...rule })}
                      className="p-1 text-cp-text-dim/40 hover:text-cp-text rounded transition-colors"
                      title="编辑"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-1 text-cp-text-dim/40 hover:text-red-400 rounded transition-colors"
                      title="删除"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content preview (collapsed) */}
                {!isEditing && rule.content && (
                  <div className="px-4 pb-3">
                    <p className="text-[11px] text-cp-text-dim/40 line-clamp-2 font-mono leading-relaxed">{rule.content}</p>
                  </div>
                )}

                {/* Edit panel (expanded) */}
                {isEditing && editingRule && (
                  <div className="px-4 pb-4 space-y-3 border-t border-cp-border/20 pt-3">
                    {/* Name */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-cp-text-dim w-[60px] shrink-0">名称</label>
                      <input
                        type="text"
                        value={editingRule.name}
                        onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                        className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
                      />
                    </div>

                    {/* Type */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-cp-text-dim w-[60px] shrink-0">类型</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map((type) => {
                          const tc = RULE_TYPE_COLORS[type];
                          return (
                            <button
                              key={type}
                              onClick={() => setEditingRule({ ...editingRule, type })}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                                editingRule.type === type
                                  ? `${tc.bg} ${tc.text} ${tc.border}`
                                  : 'border-cp-border/30 text-cp-text-dim/50 hover:border-cp-border/50'
                              }`}
                            >
                              {RULE_TYPE_LABELS[type]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Model description */}
                    {editingRule.type === 'model' && (
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-cp-text-dim w-[60px] shrink-0">场景</label>
                        <input
                          type="text"
                          value={editingRule.description || ''}
                          onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                          placeholder="例: 生成一个单元测试"
                          className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
                        />
                      </div>
                    )}

                    {/* File patterns */}
                    {editingRule.type === 'filePattern' && (
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-cp-text-dim w-[60px] shrink-0">文件</label>
                        <input
                          type="text"
                          value={editingRule.filePatterns || ''}
                          onChange={(e) => setEditingRule({ ...editingRule, filePatterns: e.target.value })}
                          placeholder="*.ts, src/**/*.tsx"
                          className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <textarea
                      value={editingRule.content}
                      onChange={(e) => setEditingRule({ ...editingRule, content: e.target.value })}
                      rows={8}
                      className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text font-mono outline-none focus:border-cp-accent resize-none leading-relaxed"
                      placeholder="规则内容..."
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-cp-text-dim/40">{editingRule.content.length} 字符</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingRule(null)} className="text-xs text-cp-text-dim hover:text-cp-text px-3 py-1.5">
                          取消
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="text-xs px-4 py-1.5 bg-cp-accent text-cp-text rounded-md hover:bg-cp-accent/80 transition-colors"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rule type reference */}
      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
        <p className="text-xs text-cp-text-dim/50 font-medium mb-3">规则类型说明</p>
        <div className="space-y-2">
          {[
            { type: 'manual' as RuleType, desc: '通过 @rule 手动应用，适用于按需工作流和自定义提示词' },
            { type: 'model' as RuleType, desc: '模型在智能体模式下评估规则描述并决定何时应用' },
            { type: 'always' as RuleType, desc: '适用于所有智能会话请求，强制执行项目级标准' },
            { type: 'filePattern' as RuleType, desc: '适用于匹配通配符模式的文件 (例: *.ts, src/**/*.tsx)' },
          ].map(({ type, desc }) => {
            const c = RULE_TYPE_COLORS[type];
            return (
              <div key={type} className="flex items-start gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${c.bg} ${c.text} ${c.border}`}>
                  {RULE_TYPE_LABELS[type]}
                </span>
                <span className="text-[11px] text-cp-text-dim/40 leading-relaxed">{desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
