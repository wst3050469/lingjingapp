// WikiStatusBanner - shows progress during generation/update, or change detection info

import { useWikiStore } from '../../stores/wiki-store';

export function WikiStatusBanner() {
  const { isGenerating, isUpdating, progress, error, clearError } = useWikiStore();

  if (error) {
    return (
      <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between">
        <span className="text-xs text-red-400 truncate">{error}</span>
        <button
          onClick={clearError}
          className="text-[10px] text-red-400/60 hover:text-red-400 ml-2 shrink-0"
        >
          关闭
        </button>
      </div>
    );
  }

  if (!isGenerating && !isUpdating) return null;
  if (!progress) return null;

  const { phase, current, total, modulePath } = progress;

  const phaseLabels: Record<string, string> = {
    scanning: '扫描代码目录...',
    generating: `生成文档 ${current}/${total}`,
    updating: `更新模块 ${current}/${total}`,
    overview: '生成项目总览...',
  };

  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-cp-accent/5 border border-cp-accent/15">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-cp-accent">
          {phaseLabels[phase] || phase}
        </span>
        {total > 0 && (
          <span className="text-[10px] text-cp-text-dim">{percentage}%</span>
        )}
      </div>
      {modulePath && (
        <p className="text-[10px] text-cp-text-dim/60 truncate mb-1.5">{modulePath}</p>
      )}
      {total > 0 && (
        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-cp-accent/60 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
