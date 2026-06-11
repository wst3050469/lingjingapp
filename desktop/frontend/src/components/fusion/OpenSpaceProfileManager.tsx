import React, { useState, useEffect } from 'react';

interface OpenSpaceProfile {
  id: string;
  name: string;
  description?: string;
  modules: string[];
  createdAt: string;
  active?: boolean;
}

export function OpenSpaceProfileManager() {
  const [profiles, setProfiles] = useState<OpenSpaceProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const result = await (window as any).electron?.invoke('openspace:list-profiles');
      setProfiles(result || []);
      const active = (result || []).find((p: OpenSpaceProfile) => p.active);
      if (active) setActiveId(active.id);
    } catch { setProfiles([]); }
    setLoading(false);
  };

  const activateProfile = async (id: string) => {
    try {
      await (window as any).electron?.invoke('openspace:activate-profile', { profileId: id });
      setActiveId(id);
      setProfiles(prev => prev.map(p => ({ ...p, active: p.id === id })));
    } catch (err) { console.error('Activate profile failed:', err); }
  };

  const deleteProfile = async (id: string) => {
    try {
      await (window as any).electron?.invoke('openspace:delete-profile', { profileId: id });
      setProfiles(prev => prev.filter(p => p.id !== id));
    } catch (err) { console.error('Delete profile failed:', err); }
  };

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-cp-text">Profile 管理</h2>
        <button onClick={loadProfiles} disabled={loading} className="text-xs text-cp-accent hover:underline disabled:opacity-50">
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {profiles.length === 0 ? (
          <div className="text-cp-text-dim/50 text-xs text-center py-8">暂无 Profile</div>
        ) : profiles.map(p => (
          <div key={p.id} className={`px-3 py-2 border-b border-cp-border/30 ${p.id === activeId ? 'bg-cp-accent/5' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-cp-text">{p.name}</span>
              <div className="flex gap-2">
                {p.id !== activeId && (
                  <button onClick={() => activateProfile(p.id)} className="text-xs text-cp-accent hover:underline">激活</button>
                )}
                <button onClick={() => deleteProfile(p.id)} className="text-xs text-red-400 hover:text-red-300">删除</button>
              </div>
            </div>
            {p.description && <p className="text-xs text-cp-text-dim mt-0.5">{p.description}</p>}
            <div className="flex gap-1 mt-1 flex-wrap">
              {p.modules.slice(0, 3).map(m => (
                <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-cp-surface text-cp-text-dim">{m}</span>
              ))}
              {p.modules.length > 3 && <span className="text-[10px] text-cp-text-dim">+{p.modules.length - 3}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
