import React, { useState } from 'react';

const SCRIPT_TEMPLATES = [
  { id: 'fly-to', name: '飞行到目标', lang: 'lua', code: '-- Fly to a celestial target\nopenspace:flyToTarget("Mars")' },
  { id: 'orbit', name: '轨道动画', lang: 'lua', code: '-- Start orbit animation\nopenspace:startOrbit("Earth", 30)' },
  { id: 'layer-toggle', name: '图层切换', lang: 'lua', code: '-- Toggle layer visibility\nopenspace:toggleLayer("Stars")' },
  { id: 'time-sync', name: '时间同步', lang: 'lua', code: '-- Sync simulation time\nopenspace:setTime("2024-01-01T00:00:00")' },
];

export function OpenSpaceScriptEditor() {
  const [code, setCode] = useState('-- Lua script for OpenSpace\n');
  const [language, setLanguage] = useState<'lua' | 'js' | 'python'>('lua');
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');

  const applyTemplate = (template: typeof SCRIPT_TEMPLATES[0]) => {
    setCode(template.code);
    setLanguage(template.lang as any);
  };

  const execute = async () => {
    setRunning(true);
    setOutput('');
    try {
      const result = await (window as any).electron?.invoke('openspace:execute', { script: code, language });
      setOutput(result?.output || '执行完成');
    } catch (err: any) {
      setOutput(`错误: ${err.message || err}`);
    }
    setRunning(false);
  };

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-cp-text">脚本编辑器</h2>
        <select value={language} onChange={e => setLanguage(e.target.value as any)} className="text-xs bg-cp-surface border border-cp-border rounded px-2 py-0.5 text-cp-text">
          <option value="lua">Lua</option>
          <option value="js">JavaScript</option>
          <option value="python">Python</option>
        </select>
      </div>
      <div className="flex gap-1 flex-wrap">
        {SCRIPT_TEMPLATES.map(t => (
          <button key={t.id} onClick={() => applyTemplate(t)} className="text-xs px-2 py-0.5 rounded bg-cp-surface border border-cp-border text-cp-text-dim hover:text-cp-text hover:border-cp-accent/50">
            {t.name}
          </button>
        ))}
      </div>
      <textarea value={code} onChange={e => setCode(e.target.value)} className="flex-1 min-h-0 bg-cp-editor border border-cp-border rounded p-2 text-xs text-cp-text font-mono resize-none focus:border-cp-accent/50 focus:outline-none" spellCheck={false} />
      <div className="flex gap-2">
        <button onClick={execute} disabled={running} className="px-3 py-1 text-xs rounded bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 disabled:opacity-50">
          {running ? '执行中...' : '执行脚本'}
        </button>
      </div>
      {output && (
        <pre className="text-xs text-cp-text-dim bg-cp-surface/50 rounded p-2 max-h-32 overflow-auto">{output}</pre>
      )}
    </div>
  );
}
