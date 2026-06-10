import React, { useEffect } from 'react';
import { useHwSkillStore } from '../../stores/hw-skill-store';
import { useHwAiStore } from '../../stores/hw-ai-store';

export function HwDesignPanel() {
  const { skills, loading, list, execute, detectCli } = useHwSkillStore();
  const { generateSchematic, suggestDrcFix, selectComponent, loading: aiLoading } = useHwAiStore();

  useEffect(() => { list(); }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-cyan-400" style={{ textShadow: '0 0 10px rgba(0,245,255,0.3)' }}>硬件设计</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-medium text-gray-400 mb-2">已安装技能</h3>
          {skills.length === 0 ? (
            <p className="text-xs text-gray-500">暂无硬件设计技能</p>
          ) : (
            <div className="space-y-1">
              {skills.map((skill: any) => (
                <div key={skill.id} className="flex items-center justify-between rounded border border-gray-700 bg-gray-800 px-3 py-2">
                  <div>
                    <span className="text-xs text-gray-200">{skill.name}</span>
                    <span className={`ml-2 text-xs ${skill.status === 'installed' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {skill.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-medium text-gray-400 mb-2">AI辅助设计</h3>
          <div className="space-y-1">
            <button onClick={() => generateSchematic('example', '')} disabled={aiLoading} className="w-full rounded bg-cyan-600/20 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-600/30 disabled:opacity-50">
              AI生成原理图
            </button>
            <button onClick={() => suggestDrcFix('[]', '')} disabled={aiLoading} className="w-full rounded bg-cyan-600/20 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-600/30 disabled:opacity-50">
              AI修复DRC
            </button>
            <button onClick={() => selectComponent('resistor 10k', '')} disabled={aiLoading} className="w-full rounded bg-cyan-600/20 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-600/30 disabled:opacity-50">
              AI元件选型
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}