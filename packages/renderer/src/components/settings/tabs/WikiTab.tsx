// WikiTab - settings tab for Repo Wiki configuration

import { useState } from 'react';

interface WikiTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h4 className="text-xs font-medium text-cp-text-dim/70 uppercase tracking-wider">{title}</h4>
      {badge && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cp-accent/15 text-cp-accent">{badge}</span>
      )}
      <div className="flex-1 h-px bg-cp-border/20" />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4">
      {children}
    </div>
  );
}

export function WikiTab({ config, saveKey }: WikiTabProps) {
  const wiki = config?.wiki || {};

  const [model, setModel] = useState<string>(wiki.model ?? '');
  const [language, setLanguage] = useState<string>(wiki.language ?? 'zh');
  const [maxFiles, setMaxFiles] = useState<number>(wiki.maxFilesPerModule ?? 50);
  const [ignorePaths, setIgnorePaths] = useState<string>((wiki.ignorePaths ?? []).join('\n'));

  const [modelDirty, setModelDirty] = useState(false);
  const [ignoreDirty, setIgnoreDirty] = useState(false);

  const handleSaveModel = () => {
    saveKey('wiki.model', model);
    setModelDirty(false);
  };

  const handleSaveLanguage = (lang: string) => {
    setLanguage(lang);
    saveKey('wiki.language', lang);
  };

  const handleSaveMaxFiles = (val: number) => {
    setMaxFiles(val);
    saveKey('wiki.maxFilesPerModule', val);
  };

  const handleSaveIgnore = () => {
    const paths = ignorePaths.split('\n').map((l) => l.trim()).filter(Boolean);
    saveKey('wiki.ignorePaths', paths);
    setIgnoreDirty(false);
  };

  return (
    <div className="space-y-8">
      {/* Model Configuration */}
      <div>
        <SectionHeader title="生成模型" />
        <Card>
          <div className="mb-3">
            <p className="text-sm text-cp-text font-medium">Wiki 专用模型</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
              设置用于生成 Wiki 文档的 LLM 模型。留空则使用主模型。格式: provider:model (例如 glm:glm-5.1)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={model}
              onChange={(e) => { setModel(e.target.value); setModelDirty(true); }}
              placeholder={config?.model || 'ollama:gemma4:e4b'}
              className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
            />
            {modelDirty && (
              <button
                onClick={handleSaveModel}
                className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
              >
                保存
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* Language */}
      <div>
        <SectionHeader title="文档语言" />
        <Card>
          <div className="mb-3">
            <p className="text-sm text-cp-text font-medium">Wiki 输出语言</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
              选择生成 Wiki 文档的语言。切换语言后需要重新生成。
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSaveLanguage('zh')}
              className={`text-xs px-4 py-1.5 rounded-md transition-colors ${
                language === 'zh'
                  ? 'bg-cp-accent/20 text-cp-accent border border-cp-accent/30'
                  : 'bg-white/[0.06] text-cp-text-dim hover:bg-white/10 border border-cp-border/30'
              }`}
            >
              中文
            </button>
            <button
              onClick={() => handleSaveLanguage('en')}
              className={`text-xs px-4 py-1.5 rounded-md transition-colors ${
                language === 'en'
                  ? 'bg-cp-accent/20 text-cp-accent border border-cp-accent/30'
                  : 'bg-white/[0.06] text-cp-text-dim hover:bg-white/10 border border-cp-border/30'
              }`}
            >
              English
            </button>
          </div>
        </Card>
      </div>

      {/* Max Files */}
      <div>
        <SectionHeader title="分析限制" />
        <Card>
          <div className="mb-3">
            <p className="text-sm text-cp-text font-medium">每个模块最大文件数</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
              限制每个模块发送给 LLM 分析的最大文件数量。过多文件可能超出上下文限制。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={maxFiles}
              onChange={(e) => handleSaveMaxFiles(Number(e.target.value))}
              className="flex-1 accent-cp-accent"
            />
            <span className="text-sm text-cp-text font-mono w-8 text-right">{maxFiles}</span>
          </div>
        </Card>
      </div>

      {/* Ignore Paths */}
      <div>
        <SectionHeader title="忽略路径" />
        <Card>
          <div className="mb-3">
            <p className="text-sm text-cp-text font-medium">排除目录</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
              指定在 Wiki 生成时跳过的目录路径，每行一个。
            </p>
          </div>
          <textarea
            value={ignorePaths}
            onChange={(e) => { setIgnorePaths(e.target.value); setIgnoreDirty(true); }}
            placeholder={"test\nscripts\ndocs"}
            rows={4}
            className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text font-mono outline-none focus:border-cp-accent resize-none leading-relaxed"
          />
          {ignoreDirty && (
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSaveIgnore}
                className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
              >
                保存
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
