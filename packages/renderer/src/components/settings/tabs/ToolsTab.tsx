import { useState, useEffect } from 'react';
import { Section } from '../SettingsPrimitives';

interface ToolsTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

interface ToolInfo {
  name: string;
  description: string;
}

export function ToolsTab({ config, saveKey }: ToolsTabProps) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const disabledTools: string[] = config?.tools?.disabled || [];

  useEffect(() => {
    window.electronAPI.tools.list()
      .then(setTools)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleTool = (name: string) => {
    const newDisabled = disabledTools.includes(name)
      ? disabledTools.filter((t) => t !== name)
      : [...disabledTools, name];
    saveKey('tools.disabled', newDisabled);
  };

  if (loading) {
    return <p className="text-sm text-cp-text-dim">加载工具列表...</p>;
  }

  return (
    <div className="space-y-6">
      <Section title="内置工具">
        <p className="text-xs text-cp-text-dim/60 mb-3">
          启用或禁用 AI 可调用的内置工具。禁用的工具不会出现在 AI 的可用工具列表中。
        </p>
        <div className="space-y-1">
          {tools.map((tool) => {
            const enabled = !disabledTools.includes(tool.name);
            return (
              <div
                key={tool.name}
                className="flex items-center gap-3 bg-white/[0.02] border border-cp-border/50 rounded-lg px-3 py-2.5"
              >
                <button
                  onClick={() => toggleTool(tool.name)}
                  className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
                    enabled ? 'bg-green-500' : 'bg-cp-text-dim/20'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      enabled ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <span className={`text-sm font-mono ${enabled ? 'text-cp-text' : 'text-cp-text-dim/50'}`}>
                    {tool.name}
                  </span>
                  <p className="text-[10px] text-cp-text-dim/50 truncate">{tool.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
