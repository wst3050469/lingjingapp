import React, { useEffect, useState } from 'react';
import { useOpenSpaceStore } from '../../stores/openspace-store';

const PRESET_TEMPLATES = [
  { id: 'solar_system', label: '太阳系探索', description: '完整太阳系可视化' },
  { id: 'earth_observation', label: '地球观测', description: '地球近景+大气层' },
  { id: 'deep_space', label: '深空观测', description: '银河系及星系尺度' },
];

export function OpenSpaceProfileManager() {
  const {
    profiles, activeProfileId, runState,
    listProfiles, createProfile, deleteProfile, hotReloadProfile,
  } = useOpenSpaceStore();

  const [newName, setNewName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(PRESET_TEMPLATES[0].id);

  useEffect(() => {
    listProfiles();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const tpl = PRESET_TEMPLATES.find((t) => t.id === selectedTemplate);
    await createProfile({
      name: newName.trim(),
      path: `profiles/${newName.trim()}`,
      modules: tpl?.id === 'solar_system'
        ? ['SolarSystem', 'Sun', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
        : tpl?.id === 'earth_observation'
          ? ['Earth', 'EarthAtmosphere', 'EarthClouds', 'EarthNightLights']
          : ['MilkyWay', 'GalaxyClusters', 'SloanDigitalSkySurvey'],
      metadata: { description: tpl?.description || '', category: 'default' },
    });
    setNewName('');
    listProfiles();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-200">Profile 管理</h2>
        <button
          onClick={() => hotReloadProfile()}
          disabled={runState !== 'running' || !activeProfileId}
          className="rounded bg-yellow-700 px-2 py-1 text-xs text-yellow-200 hover:bg-yellow-600 disabled:opacity-50"
          title="热更新当前 Profile"
        >
          热更新
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Create new profile */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2">
          <span className="text-xs font-medium text-gray-300">新建 Profile</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Profile 名称..."
              className="flex-1 rounded bg-gray-900 border border-gray-600 px-2 py-1 text-xs text-gray-200 placeholder-gray-500"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-500 disabled:opacity-50"
            >
              创建
            </button>
          </div>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-xs text-gray-200"
          >
            {PRESET_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label} — {t.description}</option>
            ))}
          </select>
        </div>

        {/* Profile list */}
        {profiles.length === 0 ? (
          <p className="text-center text-xs text-gray-500 py-4">无 Profile</p>
        ) : (
          <div className="space-y-1">
            {profiles.map((profile) => (
              <div
                key={profile.name}
                className={`flex items-center justify-between rounded border px-2 py-1.5 ${
                  activeProfileId === profile.name
                    ? 'border-blue-600/50 bg-blue-900/20'
                    : 'border-gray-700 bg-gray-800'
                }`}
              >
                <div className="min-w-0">
                  <span className="text-xs font-medium text-gray-200">{profile.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{profile.modules.length} 模块</span>
                </div>
                <button
                  onClick={() => deleteProfile(profile.name)}
                  className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/30"
                  title="删除"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}

        {runState === 'running' && activeProfileId && (
          <div className="rounded-lg border border-green-700/30 bg-green-900/10 p-2">
            <p className="text-xs text-green-400">✅ 当前活动 Profile: {activeProfileId}</p>
          </div>
        )}
      </div>
    </div>
  );
}
