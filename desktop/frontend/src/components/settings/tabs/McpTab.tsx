import { useState, useEffect } from 'react';

/* --- MCP 广场预设数据 --- */

interface MarketplaceMcp {
  id: string;
  name: string;
  publisher: string;
  stars: number;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  builtin?: boolean;
  unavailable?: boolean;
  /** 内置且无需配置，应用启动时自动连接，用户无需点击 */
  autoConnectable?: boolean;
}

const MARKETPLACE_ITEMS: MarketplaceMcp[] = [
  {
    id: 'github',
    name: 'GitHub',
    publisher: 'modelcontextprotocol',
    stars: 59137,
    description: '用于 GitHub API 的 MCP 服务器，支持文件操作、仓库管理、搜索功能等更多功能。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
  builtin: true,
  autoConnectable: false,
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    publisher: 'modelcontextprotocol',
    stars: 58048,
    description: '一种 MCP 服务器实现，它通过结构化的思维过程提供了一种动态且反射性的解决问题的工具。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
  builtin: true,
  autoConnectable: true,
  },
  {
    id: 'playwright',
    name: 'Playwright',
    publisher: 'microsoft',
    stars: 55917,
    description: '一种模型上下文协议服务器，它使大型语言模型能够通过结构化的可访问性快照与网页交互，而无需使用视觉模型或截图。',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
  builtin: true,
  autoConnectable: false,
  },
  {
    id: 'context7',
    name: 'Context7',
    publisher: 'upstash',
    stars: 52798,
    description: '一种模型上下文协议服务器，它从库中直接获取最新、特定版本的文档和代码示例并将其引入 LLM 提示中，帮助开发人员获得准确的答案。',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest'],
    env: { CONTEXT7_API_KEY: '' },
  builtin: true,
  autoConnectable: false,
  },
  {
    id: 'fetch',
    name: 'Fetch',
    publisher: 'modelcontextprotocol',
    stars: 36990,
    description: '网页内容抓取，将HTML转换为Markdown (⚠️ npm包 @modelcontextprotocol/server-fetch 已从npm删除)',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
  builtin: false,
  unavailable: true,
  autoConnectable: false,
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    publisher: 'modelcontextprotocol',
    stars: 28456,
    description: '集成 Brave 搜索 API 的 MCP 服务器，支持网页搜索和本地搜索功能。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '' },
  builtin: true,
  autoConnectable: false,
  },
  {
    id: 'weather',
    name: 'Weather',
    publisher: 'h1deya',
    stars: 500,
    description: '天气数据查询，支持全球城市天气和预警',
    command: 'node',
    args: [],
    builtin: true,
  autoConnectable: true,
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    publisher: 'modelcontextprotocol',
    stars: 25134,
    description: '提供文件系统操作的 MCP 服务器，支持读取、写入、搜索和管理文件与目录。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
  builtin: true,
  autoConnectable: true,
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    publisher: 'modelcontextprotocol',
    stars: 18922,
    description: '连接 PostgreSQL 数据库的 MCP 服务器，支持查询执行、表结构探索和数据管理。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: { DATABASE_URL: '' },
  builtin: true,
  autoConnectable: false,
  },
  {
    id: 'redis',
    name: 'Redis',
    publisher: 'modelcontextprotocol',
    stars: 12845,
    description: '连接 Redis 数据库的 MCP 服务器，支持键值操作、数据结构管理和缓存功能。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-redis'],
    env: { REDIS_URL: '' },
  builtin: true,
  autoConnectable: false,
  },
  {
    id: 'slack',
    name: 'Slack',
    publisher: 'modelcontextprotocol',
    stars: 15603,
    description: '集成 Slack API 的 MCP 服务器，支持频道管理、消息发送和工作区交互。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: { SLACK_BOT_TOKEN: '' },
  builtin: true,
  autoConnectable: false,
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    publisher: 'modelcontextprotocol',
    stars: 14210,
    description: '集成 Google Drive API 的 MCP 服务器，支持文件搜索、读取和管理云端文档。',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-gdrive'],
    env: { GOOGLE_CREDENTIALS: '' },
  builtin: true,
  autoConnectable: false,
  },
  {
    id: 'figma',
    name: 'Framelink MCP for Figma',
    publisher: 'Framelink',
    stars: 11856,
    description: '通过 Figma API 获取设计文件数据和图片资源的 MCP 服务器，支持布局、样式和组件信息提取。',
    command: 'npx',
    args: ['-y', 'framelink-figma-mcp'],
  builtin: false,
  unavailable: true,  // framelink-figma-mcp npm 404
  autoConnectable: false,
  },
];

/* --- Helper --- */

function formatStars(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

/* --- Types --- */

interface McpTabProps {
  mcpServers: Array<{ name: string; tools: Array<{ name: string; description?: string }> }>;
  onServersChange: () => void;
  showStatus: (msg: string) => void;
}

/* --- Main Component --- */

export function McpTab({ mcpServers, onServersChange, showStatus }: McpTabProps) {
  const [view, setView] = useState<'my' | 'marketplace'>('my');
  const [selectedServer, setSelectedServer] = useState<string | null>(mcpServers[0]?.name || null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [ghTokenModal, setGhTokenModal] = useState<{ itemId: string; itemName: string } | null>(null);
  const [ghTokenInput, setGhTokenInput] = useState('');
  const [ghTokenVerifying, setGhTokenVerifying] = useState(false);
  const [ghTokenError, setGhTokenError] = useState('');
  // Generic env var input modal (for services needing GOOGLE_CREDENTIALS, SLACK_BOT_TOKEN, REDIS_URL, etc.)
  const [envModal, setEnvModal] = useState<{ itemId: string; itemName: string; requiredKeys: string[] } | null>(null);
  const [envInputs, setEnvInputs] = useState<Record<string, string>>({});

  // Listen for Chromium install progress events
  useEffect(() => {
    if (!window.electronAPI?.mcp?.onChromiumInstallProgress) return;
    const unsub = window.electronAPI.mcp.onChromiumInstallProgress((data) => {
      if (data?.message) {
        showStatus(data.message);
      }
    });
    return unsub;
  }, []);

  // Add server form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTransportType, setNewTransportType] = useState<'stdio' | 'sse'>('stdio');
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newArgs, setNewArgs] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newHeaders, setNewHeaders] = useState('');

  const connectedNames = new Set(mcpServers.map((s) => s.name.toLowerCase()));

  const isInstalled = (id: string) => {
    return connectedNames.has(id) || mcpServers.some((s) =>
      s.name.toLowerCase().includes(id) || id.includes(s.name.toLowerCase())
    );
  };

  const handleConnect = async () => {
    if (!newName.trim()) return;
    if (newTransportType === 'stdio' && !newCommand.trim()) return;
    if (newTransportType === 'sse' && !newUrl.trim()) return;

    setInstalling('__connecting__');
    showStatus('正在连接 MCP 服务器...');

    let config: any;
    if (newTransportType === 'stdio') {
      const args = newArgs.trim() ? newArgs.split(' ') : [];
      config = { command: newCommand, args };
    } else {
      config = {
        type: 'sse',
        url: newUrl.trim(),
      };
      if (newHeaders.trim()) {
        const headers: Record<string, string> = {};
        newHeaders.split('\n').forEach(line => {
          const idx = line.indexOf(':');
          if (idx !== -1) {
            const key = line.substring(0, idx).trim();
            const value = line.substring(idx + 1).trim();
            if (key && value) headers[key] = value;
          }
        });
        if (Object.keys(headers).length > 0) {
          config.headers = headers;
        }
      }
    }

    try {
      const result = await window.electronAPI.mcp.connect(newName, config);
      if (result.success) {
        showStatus(`已连接 ${newName}`);
        setNewName('');
        setNewCommand('');
        setNewArgs('');
        setNewUrl('');
        setNewHeaders('');
        setNewTransportType('stdio');
        setShowAddForm(false);
        onServersChange();
      } else {
        const errMsg = result.error || '未知错误';
        const category = result.errorCategory ? ` (${result.errorCategory})` : '';
        showStatus(`连接失败${category}: ${errMsg}`);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      showStatus(`连接失败: ${msg}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleDisconnect = async (name: string) => {
    await window.electronAPI.mcp.disconnect(name);
    if (selectedServer === name) setSelectedServer(null);
    onServersChange();
    showStatus(`已断开 ${name}`);
  };

  const handleInstallMarketplace = async (item: MarketplaceMcp) => {
    let installEnv: Record<string, string> | undefined;

    if (item.env) {
      const emptyKeys = Object.entries(item.env).filter(([, v]) => !v || !v.trim());
      if (emptyKeys.length > 0) {
        // Try to auto-fill GITHUB_PERSONAL_ACCESS_TOKEN from integrations
        if (item.id === 'github' && emptyKeys.some(([k]) => k === 'GITHUB_PERSONAL_ACCESS_TOKEN')) {
          try {
            const ghSaved = await window.electronAPI.integrations.githubGetSavedToken();
            if (ghSaved?.connected && ghSaved?.token) {
              installEnv = { GITHUB_PERSONAL_ACCESS_TOKEN: ghSaved.token };
            } else {
              setGhTokenModal({ itemId: item.id, itemName: item.name });
              return;
            }
          } catch {
            setGhTokenModal({ itemId: item.id, itemName: item.name });
            return;
          }
        } else {
          const requiredKeys = emptyKeys.map(([k]) => k);
          const initialInputs: Record<string, string> = {};
          requiredKeys.forEach(k => { initialInputs[k] = ''; });
          setEnvInputs(initialInputs);
          setEnvModal({ itemId: item.id, itemName: item.name, requiredKeys });
          return;
        }
      } else {
        installEnv = Object.fromEntries(Object.entries(item.env).filter(([, v]) => v && v.trim()));
      }
    }

    setInstalling(item.id);
    showStatus(`正在连接 ${item.name}...`);
    try {
      const result = await window.electronAPI.mcp.marketplaceInstall(item.id, installEnv);
      if (result.success) {
        showStatus(`已连接 ${item.name}`);
        onServersChange();
      } else {
        const errMsg = result.error || '未知错误';
        const category = result.errorCategory ? ` (${result.errorCategory})` : '';
        showStatus(`连接失败${category}: ${errMsg}`);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      showStatus(`连接失败: ${msg}`);
    } finally {
      setInstalling(null);
    }
  };

  const selectedDetail = mcpServers.find((s) => s.name === selectedServer);

  const handleGhTokenVerifyAndInstall = async () => {
    if (!ghTokenInput.trim()) {
      setGhTokenError('请输入 GitHub Token');
      return;
    }
    setGhTokenVerifying(true);
    setGhTokenError('');
    try {
      const res = await window.electronAPI.integrations.githubConnect(ghTokenInput.trim());
      if (res.success) {
        const installEnv = { GITHUB_PERSONAL_ACCESS_TOKEN: ghTokenInput.trim() };
        setGhTokenModal(null);
        setGhTokenInput('');
        if (ghTokenModal) {
          setInstalling(ghTokenModal.itemId);
          showStatus(`正在连接 ${ghTokenModal.itemName}...`);
          try {
            const result = await window.electronAPI.mcp.marketplaceInstall(ghTokenModal.itemId, installEnv);
            if (result.success) {
              showStatus(`已连接 ${ghTokenModal.itemName}`);
              onServersChange();
            } else {
              const errMsg = result.error || '未知错误';
              const category = result.errorCategory ? ` (${result.errorCategory})` : '';
              showStatus(`连接失败${category}: ${errMsg}`);
            }
          } catch (err: any) {
            showStatus(`连接失败: ${err?.message || String(err)}`);
          } finally {
            setInstalling(null);
          }
        }
      } else {
        setGhTokenError(res.error || 'Token验证失败');
      }
    } catch (err: any) {
      setGhTokenError(err.message || '连接失败');
    } finally {
      setGhTokenVerifying(false);
    }
  };

  const handleEnvSubmit = async () => {
    if (!envModal) return;
    const ek = envModal.requiredKeys.find(k => !envInputs[k]?.trim());
    if (ek) { showStatus('请填写 ' + ek); return; }
    setInstalling(envModal.itemId);
    showStatus('正在连接 ' + envModal.itemName + '...');
    const mid = envModal.itemId;
    const ie = { ...envInputs };
    setEnvModal(null); setEnvInputs({});
    try {
      const r = await window.electronAPI.mcp.marketplaceInstall(mid, ie);
      if (r.success) { showStatus('已连接 ' + envModal.itemName); onServersChange(); }
      else { showStatus('连接失败: ' + (r.error || '未知错误')); }
    } catch (err: any) { showStatus('连接失败: ' + (err?.message || String(err))); }
    finally { setInstalling(null); }
  };

  return (
    <div className="space-y-0">
      {/* Header with tabs and add button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-white/[0.03] border border-cp-border/30 rounded-lg p-0.5">
          <button
            onClick={() => setView('my')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === 'my' ? 'bg-cp-surface text-cp-text' : 'text-cp-text-dim hover:text-cp-text'
            }`}
          >
            我的服务
          </button>
          <button
            onClick={() => setView('marketplace')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === 'marketplace' ? 'bg-cp-surface text-cp-text' : 'text-cp-text-dim hover:text-cp-text'
            }`}
          >
            MCP 广场
          </button>
        </div>
        {view === 'my' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            添加
          </button>
        )}
      </div>

      <p className="text-[11px] text-cp-text-dim/50 mb-4">
        {view === 'my'
          ? '连接 MCP 服务为智能体扩展更多工具。内置服务无需操作，启动后自动连接。'
          : '浏览并启用 MCP 服务。内置服务无需额外操作，启动后自动连接可用。'}
      </p>

      {/* --- 我的服务 --- */}
      {view === 'my' && (
        <div>
          {/* Add form */}
          {showAddForm && (
            <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 mb-4 space-y-2.5">
              <p className="text-xs text-cp-text font-medium mb-2">添加 MCP 服务器</p>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
                placeholder="服务器名称 (例: my-remote-server)"
              />
              
              {/* Transport type selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-cp-text-dim">传输类型:</label>
                <div className="flex items-center gap-1 bg-white/[0.03] border border-cp-border/30 rounded-lg p-0.5">
                  <button
                    onClick={() => setNewTransportType('stdio')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      newTransportType === 'stdio' ? 'bg-cp-surface text-cp-text' : 'text-cp-text-dim hover:text-cp-text'
                    }`}
                  >
                    STDIO
                  </button>
                  <button
                    onClick={() => setNewTransportType('sse')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      newTransportType === 'sse' ? 'bg-cp-surface text-cp-text' : 'text-cp-text-dim hover:text-cp-text'
                    }`}
                  >
                    SSE
                  </button>
                </div>
              </div>

              {/* STDIO fields */}
              {newTransportType === 'stdio' && (
                <>
                  <input
                    type="text"
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
                    placeholder="命令 (例: npx)"
                  />
                  <input
                    type="text"
                    value={newArgs}
                    onChange={(e) => setNewArgs(e.target.value)}
                    className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
                    placeholder="参数 (空格分隔, 例: -y @modelcontextprotocol/server-github)"
                  />
                </>
              )}

              {/* SSE fields */}
              {newTransportType === 'sse' && (
                <>
                  <input
                    type="text"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
                    placeholder="SSE 服务器 URL (例: http://localhost:3000/sse)"
                  />
                  <textarea
                    value={newHeaders}
                    onChange={(e) => setNewHeaders(e.target.value)}
                    className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent resize-none"
                    rows={2}
                    placeholder="自定义请求头 (每行一个, 格式: Key: Value)&#10;例: Authorization: Bearer your-token"
                  />
                </>
              )}

              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-cp-text-dim hover:text-cp-text px-3 py-1.5"
                >
                  取消
                </button>
                <button
                  onClick={handleConnect}
                  disabled={!newName.trim() || (newTransportType === 'stdio' ? !newCommand.trim() : !newUrl.trim())}
                  className="text-xs px-4 py-1.5 bg-cp-accent text-cp-text rounded-md hover:bg-cp-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  连接
                </button>
              </div>
            </div>
          )}

          {mcpServers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-cp-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <p className="text-sm text-cp-text-dim/50 mb-3">暂无已连接的 MCP 服务器</p>
              <button
                onClick={() => setView('marketplace')}
                className="text-xs px-4 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
              >
                前往 MCP 广场启用
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              {/* Server list (left) */}
              <div className="w-[200px] shrink-0 space-y-1">
                {mcpServers.map((server) => (
                  <button
                    key={server.name}
                    onClick={() => setSelectedServer(server.name)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedServer === server.name
                        ? 'bg-white/[0.08] text-cp-text'
                        : 'text-cp-text-dim hover:bg-white/[0.04] hover:text-cp-text'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="text-sm truncate flex-1">{server.name}</span>
                    <svg className="w-3.5 h-3.5 text-cp-text-dim/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>

              {/* Server detail (right) */}
              <div className="flex-1 bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
                {selectedDetail ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <h4 className="text-sm text-cp-text font-medium">{selectedDetail.name}</h4>
                      </div>
                      <button
                        onClick={() => handleDisconnect(selectedDetail.name)}
                        className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                      >
                        断开连接
                      </button>
                    </div>
                    <p className="text-xs text-cp-text-dim/60 mb-3">{selectedDetail.tools.length} 个工具可用</p>
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {selectedDetail.tools.map((tool) => (
                        <div key={tool.name} className="bg-black/20 rounded-lg px-3 py-2">
                          <p className="text-xs text-cp-text font-mono">{tool.name}</p>
                          {tool.description && (
                            <p className="text-[10px] text-cp-text-dim/50 mt-0.5 line-clamp-2">{tool.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-sm text-cp-text-dim/40">
                    选择一个服务器查看详情
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- MCP 广场 --- */}
      {view === 'marketplace' && (
        <div className="grid grid-cols-1 gap-3">
          {MARKETPLACE_ITEMS.map((item) => {
            const connected = connectedNames.has(item.id);
            const isConnecting = installing === item.id;
            const needsEnv = item.env && Object.keys(item.env).length > 0;
            // Determine action area content
            let actionEl;
            if (connected) {
              // Already connected — show green badge, no action needed
              actionEl = <span className="text-[10px] text-green-400/70 px-3 py-1.5">已连接</span>;
            } else if (item.autoConnectable) {
              // Auto-connects on startup — no button needed
              actionEl = <span className="text-[10px] text-blue-400/50 px-3 py-1.5">启动后自动连接</span>;
            } else if (item.unavailable) {
              // Package unavailable (npm 404)
              actionEl = <span className="text-[10px] text-cp-text-dim/30 px-3 py-1.5 italic">暂不可用</span>;
            } else {
              // Needs user action (provide env vars, or manual connect)
              actionEl = (
                <button
                  onClick={() => handleInstallMarketplace(item)}
                  disabled={isConnecting}
                  className="text-xs px-3 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 disabled:opacity-50 transition-colors"
                >
                  {isConnecting ? (needsEnv ? '配置中...' : '连接中...') : (needsEnv ? '配置并连接' : '连接')}
                </button>
              );
            }
            return (
              <div
                key={item.id}
                className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 hover:border-cp-border/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm text-cp-text font-medium">{item.name}</h4>
                      {item.builtin && !connected && !item.autoConnectable && !item.unavailable && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
                          内置
                        </span>
                      )}
                      {item.autoConnectable && !connected && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
                          内置
                        </span>
                      )}
                      {connected && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20">
                          已连接
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-cp-text-dim/50">{item.publisher}</span>
                      <span className="text-[10px] text-cp-text-dim/30">|</span>
                      <span className="flex items-center gap-0.5 text-[10px] text-cp-text-dim/50">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {formatStars(item.stars)}
                      </span>
                    </div>
                    <p className="text-[11px] text-cp-text-dim/60 leading-relaxed line-clamp-2">{item.description}</p>
                  </div>
                  <div className="shrink-0 pt-1">
                    {actionEl}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GitHub Token Modal */}
      {ghTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-cp-panel border border-cp-border/50 rounded-xl p-5 w-[420px] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm text-cp-text font-medium">配置 GitHub Token</h3>
              <button
                onClick={() => { setGhTokenModal(null); setGhTokenInput(''); setGhTokenError(''); }}
                className="text-cp-text-dim hover:text-cp-text text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-cp-text-dim leading-relaxed">
              连接 {ghTokenModal.itemName} 需要 GitHub Personal Access Token。请输入您的 Token，我们将验证并保存。
            </p>
            <div className="space-y-2">
              <input
                type="password"
                value={ghTokenInput}
                onChange={(e) => setGhTokenInput(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                onKeyDown={(e) => { if (e.key === 'Enter') handleGhTokenVerifyAndInstall(); }}
                autoFocus
              />
              {ghTokenError && <p className="text-[11px] text-red-400">{ghTokenError}</p>}
            </div>
            <div className="flex items-center gap-2 justify-between">
              <a
                href="https://github.com/settings/tokens/new?description=LingJing-IDE&scopes=repo,read:org,workflow"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-cp-text-dim/50 hover:text-cp-accent transition-colors"
              >
                前往 GitHub 创建 Token
              </a>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setGhTokenModal(null); setGhTokenInput(''); setGhTokenError(''); }}
                  className="text-xs px-3 py-1.5 rounded-md text-cp-text-dim hover:text-cp-text transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleGhTokenVerifyAndInstall}
                  disabled={ghTokenVerifying || !ghTokenInput.trim()}
                  className="text-xs px-4 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors disabled:opacity-50"
                >
                  {ghTokenVerifying ? '验证中...' : '验证并连接'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Env Var Input Modal */}
      {envModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-cp-panel border border-cp-border/50 rounded-xl p-5 w-[420px] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm text-cp-text font-medium">配置环境变量</h3>
              <button
                onClick={() => { setEnvModal(null); setEnvInputs({}); }}
                className="text-cp-text-dim hover:text-cp-text text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-cp-text-dim leading-relaxed">
              连接 {envModal.itemName} 需要配置以下环境变量：
            </p>
            <div className="space-y-3">
              {envModal.requiredKeys.map((key) => (
                <div key={key}>
                  <label className="text-[11px] text-cp-text-dim/70 block mb-1 font-mono">{key}</label>
                  <input
                    type="text"
                    value={envInputs[key] || ''}
                    onChange={(e) => setEnvInputs(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`输入 ${key}`}
                    className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                    autoFocus={key === envModal.requiredKeys[0]}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setEnvModal(null); setEnvInputs({}); }}
                className="text-xs px-3 py-1.5 rounded-md text-cp-text-dim hover:text-cp-text transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleEnvSubmit}
                disabled={installing === envModal.itemId}
                className="text-xs px-4 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors disabled:opacity-50"
              >
                {installing === envModal.itemId ? '连接中...' : '确认并连接'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
