import React, { useState, useEffect } from 'react';

interface UserProfile {
  id: string;
  codingStyle: string[];
  techStack: string[];
  workflowPatterns: string[];
  modelPreferences: Record<string, string>;
  lastUpdated: number;
}

const TAG_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
];

export const UserProfilePanel: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const fetchProfile = async () => {
    try {
      const result = await window.electronAPI?.invoke('fusion:usermodel:profile') as UserProfile;
      setProfile(result);
    } catch {}
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleReflect = async () => {
    try {
      await window.electronAPI?.invoke('fusion:usermodel:trigger');
      await fetchProfile();
    } catch {}
  };

  const renderTagCloud = (items: string[], colorOffset = 0) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={item}
          className={`px-2 py-0.5 text-xs rounded-full ${TAG_COLORS[(i + colorOffset) % TAG_COLORS.length]}`}
        >
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">用户画像</h2>
        <button
          onClick={handleReflect}
          className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          触发反思
        </button>
      </div>

      {!profile ? (
        <div className="text-sm text-gray-500 text-center py-8">加载中...</div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">用户ID: {profile.id}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              最后更新: {new Date(profile.lastUpdated).toLocaleString()}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">编码风格</h3>
            {profile.codingStyle.length > 0 ? renderTagCloud(profile.codingStyle, 0) : (
              <div className="text-xs text-gray-400">暂无数据</div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">技术栈</h3>
            {profile.techStack.length > 0 ? renderTagCloud(profile.techStack, 2) : (
              <div className="text-xs text-gray-400">暂无数据</div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">工作流模式</h3>
            {profile.workflowPatterns.length > 0 ? renderTagCloud(profile.workflowPatterns, 4) : (
              <div className="text-xs text-gray-400">暂无数据</div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">模型偏好</h3>
            {Object.keys(profile.modelPreferences).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(profile.modelPreferences).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{key}</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400">暂无数据</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
