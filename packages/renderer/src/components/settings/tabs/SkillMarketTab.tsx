import React, { useEffect, useState, useCallback } from 'react';

interface SkillItem {
  id: string;
  name: string;
  description: string;
  source: string;
  installs: number;
  version?: string;
  isDuplicate?: boolean;
  remoteUrl?: string;
}

interface GhResult {
  name: string;
  skillPath: string;
}

interface UpdateInfo {
  skillName: string;
  skillPath: string;
  localVersion: string;
  latestVersion: string;
}

const SkillMarketTab: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Record<string, boolean>>({});
  const [githubUrl, setGithubUrl] = useState('');
  const [ghImporting, setGhImporting] = useState(false);
  const [ghResult, setGhResult] = useState<GhResult | null>(null);
  const [updates, setUpdates] = useState<UpdateInfo[]>([]);

  const loadLeaderboard = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await window.electronAPI.skillMarket.getLeaderboard({ page: p, limit: 20 });
      if (res.success) {
        setSkills(prev => p === 1 ? res.data : [...prev, ...res.data]);
        setPage(p);
        setHasMore(res.hasMore);
      } else {
        setError(res.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const doSearch = useCallback(async () => {
    if (!searchQuery.trim()) { loadLeaderboard(); return; }
    setLoading(true);
    try {
      const res = await window.electronAPI.skillMarket.search({ query: searchQuery.trim(), page: 1, limit: 30 });
      if (res.success) {
        setSkills(res.data);
        setPage(1);
        setHasMore(res.hasMore);
      } else {
        setError(res.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, loadLeaderboard]);

  const checkInstalled = useCallback(async () => {
    try {
      const res = await window.electronAPI.skillMarket.getInstalledSkillIds();
      if (res.success) setInstalledIds(res.data || {});
    } catch {}
  }, []);

  const doInstall = async (skill: SkillItem) => {
    setInstalling(skill.id);
    setError('');
    try {
      const res = await window.electronAPI.skillMarket.install({ skillId: skill.id, skill });
      if (res.success) {
        setInstalledIds(prev => ({ ...prev, [skill.id]: true }));
        if (onRefresh) onRefresh();
      } else {
        setError(res.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInstalling(null);
    }
  };

  const doInstallFromGithub = async () => {
    if (!githubUrl.trim()) return;
    setGhImporting(true);
    setGhResult(null);
    setError('');
    try {
      const res = await window.electronAPI.skillMarket.installFromGithub({ url: githubUrl.trim() });
      if (res.success) {
        setGhResult(res);
        setGithubUrl('');
        if (onRefresh) onRefresh();
      } else {
        setError(res.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGhImporting(false);
    }
  };

  const checkUpdates = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.skillMarket.checkUpdates();
      if (res.success) setUpdates(res.updates || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const doUpdate = async (skillPath: string) => {
    setInstalling(skillPath);
    setError('');
    try {
      const res = await window.electronAPI.skillMarket.update({ skillPath });
      if (res.success) {
        checkUpdates();
        if (onRefresh) onRefresh();
      } else {
        setError(res.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInstalling(null);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    checkUpdates();
  }, []);

  useEffect(() => { checkInstalled(); }, [skills]);

  const fmt = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-cp-text-dim/50 leading-relaxed">
        浏览 skills.sh 技能生态或通过 GitHub 地址一键导入。安装后技能统一管理于本地技能列表。
      </p>

      <div className="flex items-center gap-2 mb-4">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="搜索 skills.sh 上的技能..."
          className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
        />
        <button onClick={doSearch} className="text-xs px-3 py-1.5 bg-cp-accent/20 text-cp-accent rounded-md hover:bg-cp-accent/30">
          搜索
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-[11px] text-red-400 flex items-center justify-between mb-3">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400">×</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-cp-accent/30 border-t-cp-accent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
          <h4 className="text-sm text-cp-text font-medium mb-3">Skills.sh 排行榜</h4>
          <div className="space-y-1">
            {skills.filter(s => !s.isDuplicate).map((skill) => (
              <div key={skill.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-cp-border/20 rounded-lg">
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-cp-text truncate block">{skill.name}</span>
                  <span className="text-[10px] text-cp-text-dim/30">{skill.source} · {fmt(skill.installs)} 安装</span>
                </div>
                {installedIds[skill.id] ? (
                  <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 shrink-0">已安装</span>
                ) : (
                  <button
                    onClick={() => doInstall(skill)}
                    disabled={installing === skill.id}
                    className="text-[11px] px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 disabled:opacity-50 shrink-0"
                  >
                    {installing === skill.id ? '安装中...' : '安装'}
                  </button>
                )}
              </div>
            ))}
            {hasMore && (
              <button onClick={() => loadLeaderboard(page + 1)} className="w-full text-[11px] text-cp-text-dim/50 hover:text-cp-text py-2">
                加载更多
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4 mt-4">
        <h4 className="text-sm text-cp-text font-medium mb-3">通过 GitHub 地址一键生成技能</h4>
        <p className="text-[11px] text-cp-text-dim/40 mb-3">
          输入任意 GitHub 开源仓库地址，系统自动分析代码并生成可调用的技能。
        </p>
        <div className="flex items-center gap-2 mb-3">
          <input
            value={githubUrl}
            onChange={e => setGithubUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doInstallFromGithub()}
            placeholder="https://github.com/owner/repo"
            className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
          />
          <button
            onClick={doInstallFromGithub}
            disabled={ghImporting || !githubUrl.trim()}
            className="text-xs px-4 py-1.5 bg-cp-accent/20 text-cp-accent rounded-md hover:bg-cp-accent/30 disabled:opacity-50 shrink-0"
          >
            {ghImporting ? '分析中...' : '生成技能'}
          </button>
        </div>
        {ghResult && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 text-[11px] text-emerald-400">
            ✅ 技能 {ghResult.name} 已成功生成！
          </div>
        )}
      </div>

      {updates.length > 0 && (
        <div className="bg-white/[0.02] border border-amber-500/20 rounded-xl p-4 mt-4">
          <h4 className="text-sm text-cp-text font-medium mb-3 flex items-center gap-2">
            ✏️ 更新可用 ({updates.length})
          </h4>
          <div className="space-y-1">
            {updates.map(u => (
              <div key={u.skillName} className="flex items-center justify-between px-3 py-2 bg-amber-500/[0.03] border border-amber-500/10 rounded-lg">
                <span className="text-sm text-cp-text">{u.skillName} v{u.localVersion} → v{u.latestVersion}</span>
                <button
                  onClick={() => doUpdate(u.skillPath)}
                  disabled={installing === u.skillPath}
                  className="text-[11px] px-3 py-1 rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
                >
                  {installing === u.skillPath ? '更新中...' : '更新'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillMarketTab;
