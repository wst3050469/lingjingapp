import { useState } from 'react';

interface RunConfig {
  name: string;
  type: string;
  command: string;
}

const defaultConfigs: RunConfig[] = [
  { name: 'Node.js', type: 'node', command: 'node ${file}' },
  { name: 'npm start', type: 'npm', command: 'npm start' },
  { name: 'npm run dev', type: 'npm', command: 'npm run dev' },
  { name: 'Python', type: 'python', command: 'python ${file}' },
];

export function RunDebugPanel() {
  const [running, setRunning] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(0);

  const handleRun = async () => {
    const config = defaultConfigs[selectedConfig];
    if (!config) return;
    setRunning(true);
    try {
      const cmd = config.command.replace('${file}', 'index.js');
      await window.electronAPI?.terminal?.create?.(cmd);
    } catch {} finally {
      setRunning(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-cp-text-dim font-medium border-b border-cp-border flex items-center justify-between">
        <span>运行和调试</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Run button */}
        <div className="flex items-center gap-2">
          <select
            value={selectedConfig}
            onChange={e => setSelectedConfig(Number(e.target.value))}
            className="flex-1 text-xs bg-cp-bg border border-cp-border rounded px-2 py-1.5 text-cp-text focus:border-cp-accent focus:outline-none"
          >
            {defaultConfigs.map((c, i) => (
              <option key={i} value={i}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={handleRun}
            disabled={running}
            className="px-3 py-1.5 text-xs bg-cp-success/20 text-cp-success hover:bg-cp-success/30 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            {running ? '运行中' : '运行'}
          </button>
        </div>

        {/* Config info */}
        <div className="text-[10px] text-cp-text-dim/60 space-y-1">
          <p>选择运行配置后点击运行按钮，</p>
          <p>将在终端中执行命令。</p>
        </div>

        {/* JavaScript Debug Terminal */}
        <div className="border border-cp-border rounded p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-cp-text">
            <svg className="w-4 h-4 text-cp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="font-medium">JavaScript 调试终端</span>
          </div>
          <p className="text-[10px] text-cp-text-dim/60">可在终端中调试 Node.js 进程</p>
          <button
            onClick={() => window.electronAPI?.terminal?.create?.('node --inspect')}
            className="px-2 py-1 text-[10px] bg-cp-accent/10 text-cp-accent hover:bg-cp-accent/20 rounded transition-colors"
          >
            打开调试终端
          </button>
        </div>

        {/* Debug URL */}
        <div className="border border-cp-border rounded p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-cp-text">
            <svg className="w-4 h-4 text-cp-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.316-6.166M15 12l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="font-medium">调试 URL</span>
          </div>
          <p className="text-[10px] text-cp-text-dim/60">在浏览器中调试 Web 应用</p>
          <input
            type="text"
            defaultValue="http://localhost:3000"
            className="w-full text-[10px] bg-cp-bg border border-cp-border rounded px-2 py-1 text-cp-text placeholder:text-cp-text-dim/40 focus:border-cp-accent focus:outline-none"
            placeholder="输入 URL..."
          />
        </div>

        {/* Launch.json tip */}
        <div className="text-[10px] text-cp-text-dim/40 text-center pt-2">
          要自定义运行和调试，请创建 launch.json 文件
        </div>
      </div>
    </div>
  );
}
