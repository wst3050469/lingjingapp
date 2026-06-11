import { useState, useEffect, useMemo } from 'react';

/* --- Types --- */

interface SkillInfo {
  name: string;
  description: string;
  level: 'user' | 'project';
  path: string;
  hasSkillMd: boolean;
}

interface AgentInfo {
  name: string;
  description: string;
  level: 'user' | 'project';
  path: string;
}

interface Command {
  id: string;
  name: string;
  description: string;
  level: 'user' | 'project';
  content: string;
  enabled: boolean;
}

type LevelFilter = 'all' | 'user' | 'project';

interface SkillsTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* --- Helper Components --- */

function LevelBadge({ level }: { level: 'user' | 'project' }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
      level === 'user'
        ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
        : 'text-green-400 bg-green-500/10 border-green-500/20'
    }`}>
      {level === 'user' ? '用户级' : '项目级'}
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0 ${checked ? 'bg-green-500' : 'bg-white/10'}`}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[14px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

function EmptyState({ label, hint, actions }: {
  label: string;
  hint: string;
  actions: Array<{ text: string; icon: 'import' | 'add'; primary?: boolean; onClick: () => void }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-cp-text-dim/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      </div>
      <p className="text-xs text-cp-text-dim/40 mb-1">{label}</p>
      <p className="text-[11px] text-cp-text-dim/25 mb-4">{hint}</p>
      <div className="flex items-center gap-2">
        {actions.map((a) => (
          <button key={a.text} onClick={a.onClick}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md transition-colors ${
              a.primary
                ? 'bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30'
                : 'border border-cp-border/40 text-cp-text-dim/60 hover:text-cp-text hover:border-cp-border/60'
            }`}>
            {a.icon === 'import' ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            )}
            {a.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionBar({ title, count, actions }: {
  title: string;
  count: number;
  actions: Array<{ text: string; icon: 'import' | 'add'; onClick: () => void }>;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm text-cp-text font-medium">{title}</h4>
        {count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-cp-text-dim/50">{count}</span>}
      </div>
      {count > 0 && (
        <div className="flex items-center gap-1.5">
          {actions.map((a) => (
            <button key={a.text} onClick={a.onClick}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors ${
                a.icon === 'add'
                  ? 'bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30'
                  : 'border border-cp-border/30 text-cp-text-dim/50 hover:text-cp-text hover:border-cp-border/50'
              }`}>
              {a.icon === 'import' ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              )}
              {a.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- Main Component --- */

export function SkillsTab({ config, saveKey }: SkillsTabProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  // Skill detail view
  const [viewingSkill, setViewingSkill] = useState<SkillInfo | null>(null);
  const [skillContent, setSkillContent] = useState('');

  // Agent detail view
  const [viewingAgent, setViewingAgent] = useState<AgentInfo | null>(null);
  const [agentContent, setAgentContent] = useState('');

  // Create skill form
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState<'user' | 'project'>('user');
  const [newSkillContent, setNewSkillContent] = useState('');

  // Create agent form
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDesc, setNewAgentDesc] = useState('');
  const [newAgentLevel, setNewAgentLevel] = useState<'user' | 'project'>('user');
  const [newAgentPrompt, setNewAgentPrompt] = useState('');

  // Create command form
  const [showCmdForm, setShowCmdForm] = useState(false);
  const [editingCmd, setEditingCmd] = useState<Command | null>(null);
  const [newCmdName, setNewCmdName] = useState('');
  const [newCmdDesc, setNewCmdDesc] = useState('');
  const [newCmdLevel, setNewCmdLevel] = useState<'user' | 'project'>('user');
  const [newCmdContent, setNewCmdContent] = useState('');

  // Commands from config
  const commands: Command[] = useMemo(() => {
    const raw = config?.commands;
    return Array.isArray(raw) ? raw : [];
  }, [config?.commands]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sk, ag] = await Promise.all([
        window.electronAPI.skills.list(),
        window.electronAPI.skills.listAgents(),
      ]);
      setSkills(sk || []);
      setAgents(ag || []);
    } catch {
      setSkills([]);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtered
  const filteredSkills = useMemo(() =>
    levelFilter === 'all' ? skills : skills.filter((s) => s.level === levelFilter),
    [skills, levelFilter]);
  const filteredAgents = useMemo(() =>
    levelFilter === 'all' ? agents : agents.filter((a) => a.level === levelFilter),
    [agents, levelFilter]);
  const filteredCmds = useMemo(() =>
    levelFilter === 'all' ? commands : commands.filter((c) => c.level === levelFilter),
    [commands, levelFilter]);

  /* ---- Skill handlers ---- */
  const handleCreateSkill = async () => {
    if (!newSkillName.trim()) return;
    const content = newSkillContent || undefined;
    await window.electronAPI.skills.create({ name: newSkillName.trim(), description: newSkillDesc, level: newSkillLevel, content });
    resetSkillForm();
    loadAll();
  };
  const handleDeleteSkill = async (path: string) => {
    await window.electronAPI.skills.delete(path);
    if (viewingSkill?.path === path) { setViewingSkill(null); setSkillContent(''); }
    loadAll();
  };
  const handleViewSkill = async (skill: SkillInfo) => {
    if (viewingSkill?.path === skill.path) { setViewingSkill(null); setSkillContent(''); return; }
    setViewingSkill(skill);
    const res = await window.electronAPI.skills.read(skill.path);
    setSkillContent(res.success ? res.content || '' : '(SKILL.md not found)');
  };
  const resetSkillForm = () => {
    setShowSkillForm(false);
    setNewSkillName(''); setNewSkillDesc(''); setNewSkillLevel('user'); setNewSkillContent('');
  };
  const handleImportSkill = async () => {
    await window.electronAPI.fs.selectFolder();
    loadAll();
  };

  /* ---- Agent handlers ---- */
  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    await window.electronAPI.skills.createAgent({ name: newAgentName.trim(), description: newAgentDesc, level: newAgentLevel, systemPrompt: newAgentPrompt || undefined });
    resetAgentForm();
    loadAll();
  };
  const handleDeleteAgent = async (path: string) => {
    await window.electronAPI.skills.delete(path);
    if (viewingAgent?.path === path) { setViewingAgent(null); setAgentContent(''); }
    loadAll();
  };
  const handleViewAgent = async (agent: AgentInfo) => {
    if (viewingAgent?.path === agent.path) { setViewingAgent(null); setAgentContent(''); return; }
    setViewingAgent(agent);
    const res = await window.electronAPI.skills.readAgent(agent.path);
    setAgentContent(res.success ? res.content || '' : '(AGENT.md not found)');
  };
  const resetAgentForm = () => {
    setShowAgentForm(false);
    setNewAgentName(''); setNewAgentDesc(''); setNewAgentLevel('user'); setNewAgentPrompt('');
  };
  const handleImportAgent = async () => {
    await window.electronAPI.fs.selectFolder();
    loadAll();
  };

  /* ---- Command handlers ---- */
  const handleAddCmd = () => {
    if (!newCmdName.trim()) return;
    const name = newCmdName.trim().startsWith('/') ? newCmdName.trim() : '/' + newCmdName.trim();
    const cmd: Command = { id: genId(), name, description: newCmdDesc, level: newCmdLevel, content: newCmdContent, enabled: true };
    saveKey('commands', [...commands, cmd]);
    resetCmdForm();
  };
  const handleDeleteCmd = (id: string) => {
    saveKey('commands', commands.filter((c) => c.id !== id));
    if (editingCmd?.id === id) setEditingCmd(null);
  };
  const handleToggleCmd = (id: string) => {
    saveKey('commands', commands.map((c) => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };
  const handleSaveEditCmd = () => {
    if (!editingCmd) return;
    saveKey('commands', commands.map((c) => c.id === editingCmd.id ? editingCmd : c));
    setEditingCmd(null);
  };
  const resetCmdForm = () => {
    setShowCmdForm(false);
    setNewCmdName(''); setNewCmdDesc(''); setNewCmdLevel('user'); setNewCmdContent('');
  };

  /* ---- Level selector helper ---- */
  const LevelSelector = ({ value, onChange }: { value: 'user' | 'project'; onChange: (v: 'user' | 'project') => void }) => (
    <div className="flex items-center gap-1.5">
      <label className="text-[11px] text-cp-text-dim/50">级别</label>
      <div className="flex gap-1">
        {(['user', 'project'] as const).map((lv) => (
          <button key={lv} onClick={() => onChange(lv)}
            className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${value === lv
              ? lv === 'user' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'border-cp-border/30 text-cp-text-dim/50 hover:border-cp-border/50'}`}>
            {lv === 'user' ? '用户级' : '项目级'}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-cp-accent/30 border-t-cp-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <p className="text-[11px] text-cp-text-dim/50 leading-relaxed">
        通过技能<span className="text-cp-text-dim/70">(默认包含 .lingjing/skills)</span>和自定义智能体扩展智能体能力边界，创建指令简化工作流程。
      </p>

      {/* Level filter */}
      <div className="flex items-center gap-1">
        {(['all', 'user', 'project'] as LevelFilter[]).map((lv) => (
          <button key={lv} onClick={() => setLevelFilter(lv)}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              levelFilter === lv
                ? 'bg-cp-surface text-cp-text font-medium'
                : 'text-cp-text-dim/40 hover:text-cp-text-dim/70 hover:bg-white/[0.03]'
            }`}>
            {lv === 'all' ? '全部' : lv === 'user' ? '用户级' : '项目级'}
          </button>
        ))}
      </div>

      {/* ===== Skills Section ===== */}
      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
        <SectionBar title="技能" count={filteredSkills.length}
          actions={[
            { text: '导入', icon: 'import', onClick: handleImportSkill },
            { text: '新建', icon: 'add', onClick: () => setShowSkillForm(true) },
          ]} />

        {/* Create skill form */}
        {showSkillForm && (
          <div className="bg-white/[0.03] border border-cp-accent/30 rounded-lg p-3 mb-3 space-y-2.5">
            <p className="text-[11px] text-cp-text font-medium">新建技能</p>
            <input type="text" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} placeholder="技能名称 (例: log-analyzer)" autoFocus
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent" />
            <input type="text" value={newSkillDesc} onChange={(e) => setNewSkillDesc(e.target.value)} placeholder="技能描述 — 模型根据此描述决定何时使用"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent" />
            <LevelSelector value={newSkillLevel} onChange={setNewSkillLevel} />
            <textarea value={newSkillContent} onChange={(e) => setNewSkillContent(e.target.value)}
              placeholder={'SKILL.md 内容 (可选，留空使用默认模板)\n\n# 技能名称\n\n描述...\n\n## Instructions\n\n指令内容...'}
              rows={6} className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text font-mono outline-none focus:border-cp-accent resize-none leading-relaxed" />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-cp-text-dim/30">
                将创建到 {newSkillLevel === 'user' ? '~/.lingjing/skills/' : '.lingjing/skills/'}{newSkillName ? newSkillName.toLowerCase().replace(/[^a-z0-9_-]/g, '-') + '/' : ''}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={resetSkillForm} className="text-xs text-cp-text-dim hover:text-cp-text px-3 py-1.5">取消</button>
                <button onClick={handleCreateSkill} disabled={!newSkillName.trim()} className="text-xs px-4 py-1.5 bg-cp-accent text-cp-text rounded-md hover:bg-cp-accent/80 disabled:opacity-50 transition-colors">确认</button>
              </div>
            </div>
          </div>
        )}

        {/* Skill list */}
        {filteredSkills.length === 0 && !showSkillForm ? (
          <EmptyState label="暂无可用的技能" hint="创建一个或导入已有的技能。"
            actions={[
              { text: '导入', icon: 'import', onClick: handleImportSkill },
              { text: '新建', icon: 'add', primary: true, onClick: () => setShowSkillForm(true) },
            ]} />
        ) : (
          <div className="space-y-1.5">
            {filteredSkills.map((skill) => {
              const isViewing = viewingSkill?.path === skill.path;
              return (
                <div key={skill.path} className={`bg-white/[0.02] border rounded-lg overflow-hidden transition-colors ${isViewing ? 'border-cp-accent/30' : 'border-cp-border/20'}`}>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-cp-text truncate font-medium">{skill.name}</span>
                        <LevelBadge level={skill.level} />
                        {skill.hasSkillMd && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400/60 border border-emerald-500/15">SKILL.md</span>}
                      </div>
                      {skill.description && <p className="text-[11px] text-cp-text-dim/40 truncate mt-0.5">{skill.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleViewSkill(skill)} className="p-1 text-cp-text-dim/40 hover:text-cp-text rounded transition-colors" title="查看">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                      <button onClick={() => handleDeleteSkill(skill.path)} className="p-1 text-cp-text-dim/40 hover:text-red-400 rounded transition-colors" title="删除">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                  {isViewing && (
                    <div className="px-3 pb-3 border-t border-cp-border/20 pt-2.5">
                      <span className="text-[10px] text-cp-text-dim/30 font-mono block mb-2">{skill.path}</span>
                      <pre className="bg-cp-bg/50 rounded-lg p-3 text-[11px] text-cp-text-dim/60 font-mono leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">{skillContent}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Custom Agents Section ===== */}
      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
        <SectionBar title="自定义智能体" count={filteredAgents.length}
          actions={[
            { text: '导入', icon: 'import', onClick: handleImportAgent },
            { text: '新建', icon: 'add', onClick: () => setShowAgentForm(true) },
          ]} />

        {showAgentForm && (
          <div className="bg-white/[0.03] border border-cp-accent/30 rounded-lg p-3 mb-3 space-y-2.5">
            <p className="text-[11px] text-cp-text font-medium">新建智能体</p>
            <input type="text" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="智能体名称 (例: code-reviewer)" autoFocus
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent" />
            <input type="text" value={newAgentDesc} onChange={(e) => setNewAgentDesc(e.target.value)} placeholder="智能体描述"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent" />
            <LevelSelector value={newAgentLevel} onChange={setNewAgentLevel} />
            <textarea value={newAgentPrompt} onChange={(e) => setNewAgentPrompt(e.target.value)}
              placeholder="系统提示词 — 定义智能体行为与能力边界" rows={5}
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent resize-none leading-relaxed" />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-cp-text-dim/30">
                将创建到 {newAgentLevel === 'user' ? '~/.lingjing/agents/' : '.lingjing/agents/'}{newAgentName ? newAgentName.toLowerCase().replace(/[^a-z0-9_-]/g, '-') + '/' : ''}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={resetAgentForm} className="text-xs text-cp-text-dim hover:text-cp-text px-3 py-1.5">取消</button>
                <button onClick={handleCreateAgent} disabled={!newAgentName.trim()} className="text-xs px-4 py-1.5 bg-cp-accent text-cp-text rounded-md hover:bg-cp-accent/80 disabled:opacity-50 transition-colors">确认</button>
              </div>
            </div>
          </div>
        )}

        {filteredAgents.length === 0 && !showAgentForm ? (
          <EmptyState label="暂无可用的 Agent" hint="创建一个或导入已有的 Agent。"
            actions={[
              { text: '导入', icon: 'import', onClick: handleImportAgent },
              { text: '新建', icon: 'add', primary: true, onClick: () => setShowAgentForm(true) },
            ]} />
        ) : (
          <div className="space-y-1.5">
            {filteredAgents.map((agent) => {
              const isViewing = viewingAgent?.path === agent.path;
              return (
                <div key={agent.path} className={`bg-white/[0.02] border rounded-lg overflow-hidden transition-colors ${isViewing ? 'border-cp-accent/30' : 'border-cp-border/20'}`}>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-cp-text truncate font-medium">{agent.name}</span>
                        <LevelBadge level={agent.level} />
                      </div>
                      {agent.description && <p className="text-[11px] text-cp-text-dim/40 truncate mt-0.5">{agent.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleViewAgent(agent)} className="p-1 text-cp-text-dim/40 hover:text-cp-text rounded transition-colors" title="查看">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                      <button onClick={() => handleDeleteAgent(agent.path)} className="p-1 text-cp-text-dim/40 hover:text-red-400 rounded transition-colors" title="删除">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                  {isViewing && (
                    <div className="px-3 pb-3 border-t border-cp-border/20 pt-2.5">
                      <span className="text-[10px] text-cp-text-dim/30 font-mono block mb-2">{agent.path}</span>
                      <pre className="bg-cp-bg/50 rounded-lg p-3 text-[11px] text-cp-text-dim/60 font-mono leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">{agentContent}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Commands Section ===== */}
      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
        <SectionBar title="指令" count={filteredCmds.length}
          actions={[{ text: '新建', icon: 'add', onClick: () => setShowCmdForm(true) }]} />

        {showCmdForm && (
          <div className="bg-white/[0.03] border border-cp-accent/30 rounded-lg p-3 mb-3 space-y-2.5">
            <p className="text-[11px] text-cp-text font-medium">新建指令</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-cp-text-dim/50 font-mono">/</span>
              <input type="text" value={newCmdName} onChange={(e) => setNewCmdName(e.target.value.replace(/^\//, ''))} placeholder="指令名称 (例: deploy)" autoFocus
                className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent" />
            </div>
            <input type="text" value={newCmdDesc} onChange={(e) => setNewCmdDesc(e.target.value)} placeholder="指令描述 (可选)"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent" />
            <LevelSelector value={newCmdLevel} onChange={setNewCmdLevel} />
            <textarea value={newCmdContent} onChange={(e) => setNewCmdContent(e.target.value)}
              placeholder="指令内容 — 当触发此指令时发送给模型的提示词" rows={4}
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent resize-none leading-relaxed" />
            <div className="flex items-center justify-end gap-2">
              <button onClick={resetCmdForm} className="text-xs text-cp-text-dim hover:text-cp-text px-3 py-1.5">取消</button>
              <button onClick={handleAddCmd} disabled={!newCmdName.trim()} className="text-xs px-4 py-1.5 bg-cp-accent text-cp-text rounded-md hover:bg-cp-accent/80 disabled:opacity-50 transition-colors">确认</button>
            </div>
          </div>
        )}

        {filteredCmds.length === 0 && !showCmdForm ? (
          <EmptyState label="暂无可用的指令" hint={'点击"新建"创建你的第一个指令。'}
            actions={[{ text: '新建', icon: 'add', primary: true, onClick: () => setShowCmdForm(true) }]} />
        ) : (
          <div className="space-y-1.5">
            {filteredCmds.map((cmd) => {
              const isEditing = editingCmd?.id === cmd.id;
              return (
                <div key={cmd.id} className={`bg-white/[0.02] border rounded-lg overflow-hidden transition-colors ${isEditing ? 'border-cp-accent/40' : 'border-cp-border/20'}`}>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <Toggle checked={cmd.enabled} onChange={() => handleToggleCmd(cmd.id)} />
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono truncate ${cmd.enabled ? 'text-cp-text' : 'text-cp-text-dim/40'}`}>{cmd.name}</span>
                        <LevelBadge level={cmd.level} />
                      </div>
                      {cmd.description && <p className="text-[11px] text-cp-text-dim/40 truncate mt-0.5">{cmd.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditingCmd(isEditing ? null : { ...cmd })} className="p-1 text-cp-text-dim/40 hover:text-cp-text rounded transition-colors" title="编辑">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                      </button>
                      <button onClick={() => handleDeleteCmd(cmd.id)} className="p-1 text-cp-text-dim/40 hover:text-red-400 rounded transition-colors" title="删除">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                  {!isEditing && cmd.content && (
                    <div className="px-3 pb-2.5 pl-[52px]">
                      <p className="text-[11px] text-cp-text-dim/30 line-clamp-1 font-mono leading-relaxed">{cmd.content}</p>
                    </div>
                  )}
                  {isEditing && editingCmd && (
                    <div className="px-3 pb-3 space-y-2 border-t border-cp-border/20 pt-2.5">
                      <div className="flex items-center gap-3">
                        <label className="text-[11px] text-cp-text-dim w-[50px] shrink-0">名称</label>
                        <input type="text" value={editingCmd.name} onChange={(e) => setEditingCmd({ ...editingCmd, name: e.target.value })}
                          className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent" />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-[11px] text-cp-text-dim w-[50px] shrink-0">描述</label>
                        <input type="text" value={editingCmd.description} onChange={(e) => setEditingCmd({ ...editingCmd, description: e.target.value })}
                          className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent" />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-[11px] text-cp-text-dim w-[50px] shrink-0">级别</label>
                        <div className="flex gap-1">
                          {(['user', 'project'] as const).map((lv) => (
                            <button key={lv} onClick={() => setEditingCmd({ ...editingCmd, level: lv })}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${editingCmd.level === lv
                                ? lv === 'user' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'
                                : 'border-cp-border/30 text-cp-text-dim/50 hover:border-cp-border/50'}`}>
                              {lv === 'user' ? '用户级' : '项目级'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-cp-text-dim mb-1 block">指令内容</label>
                        <textarea value={editingCmd.content} onChange={(e) => setEditingCmd({ ...editingCmd, content: e.target.value })}
                          rows={5} className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text font-mono outline-none focus:border-cp-accent resize-none leading-relaxed" />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditingCmd(null)} className="text-xs text-cp-text-dim hover:text-cp-text px-3 py-1.5">取消</button>
                        <button onClick={handleSaveEditCmd} className="text-xs px-4 py-1.5 bg-cp-accent text-cp-text rounded-md hover:bg-cp-accent/80 transition-colors">保存</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
        <p className="text-xs text-cp-text-dim/50 font-medium mb-3">使用说明</p>
        <div className="space-y-2.5">
          {[
            { title: '技能 (Skills)', desc: '包含 SKILL.md 的目录，定义专业能力。模型根据描述自动决定何时使用，也可通过 /skill-name 手动触发。', color: 'text-purple-400' },
            { title: '自定义智能体', desc: '包含 AGENT.md 的目录，定义独立的智能体角色与系统提示词，适合代码审查、文档生成等专业场景。', color: 'text-cyan-400' },
            { title: '指令', desc: '输入 /指令名 触发预设提示词，简化常用工作流程。例如 /deploy 自动执行部署流程。', color: 'text-amber-400' },
          ].map(({ title, desc, color }) => (
            <div key={title} className="flex items-start gap-2">
              <span className={`text-[11px] font-medium shrink-0 mt-0.5 ${color}`}>{title}</span>
              <span className="text-[11px] text-cp-text-dim/40 leading-relaxed">{desc}</span>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-cp-border/20">
            <p className="text-[10px] text-cp-text-dim/30 leading-relaxed">
              用户级存放于 <code className="text-cp-text-dim/50 bg-white/[0.04] px-1 rounded">~/.lingjing/skills/</code> 和 <code className="text-cp-text-dim/50 bg-white/[0.04] px-1 rounded">~/.lingjing/agents/</code>，
              项目级存放于工作区 <code className="text-cp-text-dim/50 bg-white/[0.04] px-1 rounded">.lingjing/skills/</code> 和 <code className="text-cp-text-dim/50 bg-white/[0.04] px-1 rounded">.lingjing/agents/</code>。
              同名时项目级优先。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
