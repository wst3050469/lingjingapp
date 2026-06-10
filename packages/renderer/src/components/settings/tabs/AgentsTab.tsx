import { useState, useEffect } from 'react';

/* --- Types --- */

interface AgentInfo {
  name: string;
  description: string;
  level: 'user' | 'project';
  path: string;
  tools?: string[];
  skills?: string[];
  mcpServers?: string[];
  maxTurns?: number;
  temperature?: number;
  systemPrompt?: string;
}

type LevelFilter = 'all' | 'user' | 'project';

interface AgentsTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

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

function ToolBadge({ tool }: { tool: string }) {
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-cp-text-dim/60">
      {tool}
    </span>
  );
}

function EmptyState({ label, hint, actions }: {
  label: string;
  hint: string;
  actions: Array<{ text: string; icon: 'add'; primary?: boolean; onClick: () => void }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-cp-text-dim/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
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
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            {a.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/* --- Main Component --- */

const AVAILABLE_TOOLS = [
  'file_read', 'file_write', 'file_edit', 'bash', 'glob', 'grep', 'web_search', 'web_fetch'
];

export function AgentsTab({ config, saveKey }: AgentsTabProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  // View agent detail
  const [viewingAgent, setViewingAgent] = useState<AgentInfo | null>(null);
  const [agentContent, setAgentContent] = useState('');

  // Create/Edit agent form
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentInfo | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 'user' as 'user' | 'project',
    tools: [] as string[],
    skills: [] as string[],
    mcpServers: [] as string[],
    maxTurns: 30,
    temperature: 0.3,
    systemPrompt: '',
  });

  // Load agents
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const loadedAgents = await window.electronAPI.skills.listAgentsFull();
      setAgents(loadedAgents);
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = () => {
    setEditingAgent(null);
    setFormData({
      name: '',
      description: '',
      level: 'user',
      tools: [...AVAILABLE_TOOLS],
      skills: [],
      mcpServers: [],
      maxTurns: 30,
      temperature: 0.3,
      systemPrompt: '# 系统提示词\n\n你是一个专业的AI助手...',
    });
    setShowForm(true);
  };

  const handleEditAgent = async (agent: AgentInfo) => {
    setEditingAgent(agent);
    try {
      const result = await window.electronAPI.skills.readAgent(agent.path);
      if (result.success && result.content) {
        // Parse frontmatter
        const frontmatterMatch = result.content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (frontmatterMatch) {
          const frontmatterStr = frontmatterMatch[1];
          const systemPrompt = frontmatterMatch[2].trim();

          // Parse YAML-like frontmatter
          const name = frontmatterStr.match(/^name:\s*(.+)$/m)?.[1]?.trim() || '';
          const description = frontmatterStr.match(/^description:\s*(.+)$/m)?.[1]?.trim() || '';
          const maxTurns = parseInt(frontmatterStr.match(/^maxTurns:\s*(\d+)$/m)?.[1] || '30');
          const temperature = parseFloat(frontmatterStr.match(/^temperature:\s*([\d.]+)$/m)?.[1] || '0.3');

          // Parse arrays
          const parseArray = (key: string) => {
            const items: string[] = [];
            const regex = new RegExp(`^${key}:\\s*\\n((?:\\s*- .+\\n?)+)`, 'm');
            const match = frontmatterStr.match(regex);
            if (match) {
              const itemRegex = /^\s*- (.+)$/gm;
              let itemMatch;
              while ((itemMatch = itemRegex.exec(match[1])) !== null) {
                items.push(itemMatch[1].trim());
              }
            }
            return items;
          };

          setFormData({
            name,
            description,
            level: agent.level,
            tools: parseArray('tools'),
            skills: parseArray('skills'),
            mcpServers: parseArray('mcpServers'),
            maxTurns,
            temperature,
            systemPrompt,
          });
        }
      }
    } catch (err) {
      console.error('Failed to read agent:', err);
    }
    setShowForm(true);
  };

  const handleSaveAgent = async () => {
    if (!formData.name || !formData.description) {
      alert('名称和描述不能为空');
      return;
    }

    try {
      if (editingAgent) {
        // Update existing agent
        const result = await window.electronAPI.skills.saveAgent({
          path: editingAgent.path,
          ...formData,
        });
        if (result.success) {
          setShowForm(false);
          await loadAgents();
        } else {
          alert('保存失败: ' + result.error);
        }
      } else {
        // Create new agent
        const result = await window.electronAPI.skills.createAgent({
          name: formData.name,
          description: formData.description,
          level: formData.level,
          systemPrompt: `---
name: ${formData.name}
description: ${formData.description}
tools:
${formData.tools.map(t => `  - ${t}`).join('\n')}
skills:
${formData.skills.map(s => `  - ${s}`).join('\n')}
mcpServers:
${formData.mcpServers.map(m => `  - ${m}`).join('\n')}
maxTurns: ${formData.maxTurns}
temperature: ${formData.temperature}
---

${formData.systemPrompt}`,
        });
        if (result.success) {
          setShowForm(false);
          await loadAgents();
        } else {
          alert('创建失败: ' + result.error);
        }
      }
    } catch (err) {
      console.error('Failed to save agent:', err);
      alert('保存失败');
    }
  };

  const handleDeleteAgent = async (agent: AgentInfo) => {
    if (!confirm(`确定要删除智能体 "${agent.name}" 吗？`)) {
      return;
    }

    try {
      const result = await window.electronAPI.skills.delete(agent.path);
      if (result.success) {
        if (viewingAgent?.path === agent.path) {
          setViewingAgent(null);
          setAgentContent('');
        }
        await loadAgents();
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (err) {
      console.error('Failed to delete agent:', err);
      alert('删除失败');
    }
  };

  const handleViewAgent = async (agent: AgentInfo) => {
    setViewingAgent(agent);
    try {
      const result = await window.electronAPI.skills.readAgent(agent.path);
      if (result.success && result.content) {
        setAgentContent(result.content);
      }
    } catch (err) {
      console.error('Failed to read agent:', err);
    }
  };

  const toggleTool = (tool: string) => {
    setFormData(prev => ({
      ...prev,
      tools: prev.tools.includes(tool)
        ? prev.tools.filter(t => t !== tool)
        : [...prev.tools, tool],
    }));
  };

  const filteredAgents = agents.filter(a => {
    if (levelFilter === 'all') return true;
    return a.level === levelFilter;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-10 text-cp-text-dim">加载中...</div>;
  }

  // Show form
  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-cp-text">
            {editingAgent ? '编辑智能体' : '创建智能体'}
          </h3>
          <button
            onClick={() => setShowForm(false)}
            className="text-xs text-cp-text-dim hover:text-cp-text"
          >
            取消
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-cp-text-dim mb-1">名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs bg-white/5 border border-cp-border/40 rounded text-cp-text placeholder-cp-text-dim/40 focus:outline-none focus:border-cp-accent/60"
              placeholder="例如: doc-writer"
              disabled={!!editingAgent}
            />
          </div>

          <div>
            <label className="block text-xs text-cp-text-dim mb-1">描述 *</label>
            <input
              type="text"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs bg-white/5 border border-cp-border/40 rounded text-cp-text placeholder-cp-text-dim/40 focus:outline-none focus:border-cp-accent/60"
              placeholder="用于模型自动识别的描述"
            />
          </div>

          <div>
            <label className="block text-xs text-cp-text-dim mb-1">级别</label>
            <select
              value={formData.level}
              onChange={e => setFormData(prev => ({ ...prev, level: e.target.value as 'user' | 'project' }))}
              className="w-full px-2 py-1.5 text-xs bg-white/5 border border-cp-border/40 rounded text-cp-text focus:outline-none focus:border-cp-accent/60"
              disabled={!!editingAgent}
            >
              <option value="user">用户级</option>
              <option value="project">项目级</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-cp-text-dim mb-1">工具权限</label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_TOOLS.map(tool => (
                <label key={tool} className="flex items-center gap-2 text-xs text-cp-text-dim cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.tools.includes(tool)}
                    onChange={() => toggleTool(tool)}
                    className="rounded border-cp-border/40 bg-white/5 text-cp-accent focus:ring-cp-accent/40"
                  />
                  {tool}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cp-text-dim mb-1">最大轮次</label>
              <input
                type="number"
                value={formData.maxTurns}
                onChange={e => setFormData(prev => ({ ...prev, maxTurns: parseInt(e.target.value) || 30 }))}
                className="w-full px-2 py-1.5 text-xs bg-white/5 border border-cp-border/40 rounded text-cp-text focus:outline-none focus:border-cp-accent/60"
                min={1}
                max={100}
              />
            </div>

            <div>
              <label className="block text-xs text-cp-text-dim mb-1">温度</label>
              <input
                type="number"
                value={formData.temperature}
                onChange={e => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0.3 }))}
                className="w-full px-2 py-1.5 text-xs bg-white/5 border border-cp-border/40 rounded text-cp-text focus:outline-none focus:border-cp-accent/60"
                min={0}
                max={2}
                step={0.1}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-cp-text-dim mb-1">系统提示词</label>
            <textarea
              value={formData.systemPrompt}
              onChange={e => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs bg-white/5 border border-cp-border/40 rounded text-cp-text placeholder-cp-text-dim/40 focus:outline-none focus:border-cp-accent/60 font-mono"
              rows={10}
              placeholder="# 系统提示词&#10;&#10;你是一个专业的AI助手..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveAgent}
              className="flex-1 px-3 py-1.5 text-xs bg-cp-accent/20 text-cp-accent rounded hover:bg-cp-accent/30 transition-colors"
            >
              {editingAgent ? '保存' : '创建'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs border border-cp-border/40 text-cp-text-dim rounded hover:text-cp-text hover:border-cp-border/60 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show agent detail
  if (viewingAgent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setViewingAgent(null); setAgentContent(''); }}
              className="text-xs text-cp-text-dim hover:text-cp-text"
            >
              ← 返回
            </button>
            <h3 className="text-sm font-medium text-cp-text">{viewingAgent.name}</h3>
            <LevelBadge level={viewingAgent.level} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleEditAgent(viewingAgent)}
              className="text-xs px-2 py-1 border border-cp-border/40 text-cp-text-dim rounded hover:text-cp-text hover:border-cp-border/60 transition-colors"
            >
              编辑
            </button>
            <button
              onClick={() => handleDeleteAgent(viewingAgent)}
              className="text-xs px-2 py-1 border border-red-500/40 text-red-400 rounded hover:text-red-300 hover:border-red-500/60 transition-colors"
            >
              删除
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-cp-text-dim mb-2">{viewingAgent.description}</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {viewingAgent.tools?.map(tool => (
              <ToolBadge key={tool} tool={tool} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-cp-text">AGENT.md</h4>
          </div>
          <pre className="p-3 bg-black/20 rounded text-[11px] text-cp-text-dim overflow-auto max-h-[500px] whitespace-pre-wrap">
            {agentContent || '加载中...'}
          </pre>
        </div>
      </div>
    );
  }

  // Show agent list
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-cp-text">自定义智能体</h3>
        <button
          onClick={handleCreateAgent}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-cp-accent/20 text-cp-accent rounded hover:bg-cp-accent/30 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          创建
        </button>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          label="暂无自定义智能体"
          hint="创建专属AI Agent，配置工具权限和系统提示词"
          actions={[{ text: '创建智能体', icon: 'add', primary: true, onClick: handleCreateAgent }]}
        />
      ) : (
        <>
          <div className="flex gap-2">
            {(['all', 'user', 'project'] as LevelFilter[]).map(level => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`text-[11px] px-2 py-1 rounded transition-colors ${
                  levelFilter === level
                    ? 'bg-cp-accent/20 text-cp-accent'
                    : 'text-cp-text-dim hover:text-cp-text'
                }`}
              >
                {level === 'all' ? '全部' : level === 'user' ? '用户级' : '项目级'}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredAgents.map(agent => (
              <div
                key={agent.path}
                className="p-3 bg-white/[0.02] border border-cp-border/30 rounded hover:border-cp-border/50 transition-colors cursor-pointer"
                onClick={() => handleViewAgent(agent)}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-cp-text">{agent.name}</span>
                    <LevelBadge level={agent.level} />
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteAgent(agent); }}
                    className="text-[10px] text-cp-text-dim/40 hover:text-red-400 transition-colors"
                  >
                    删除
                  </button>
                </div>
                <p className="text-[11px] text-cp-text-dim mb-2">{agent.description}</p>
                <div className="flex flex-wrap gap-1">
                  {agent.tools?.slice(0, 5).map(tool => (
                    <ToolBadge key={tool} tool={tool} />
                  ))}
                  {agent.tools && agent.tools.length > 5 && (
                    <span className="text-[9px] px-1.5 py-0.5 text-cp-text-dim/40">+{agent.tools.length - 5}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
