import { useState, useEffect } from 'react';
import { useModelStore } from '../../../stores/model-store';

/* ─── Preset providers data ─── */

interface PresetProvider {
  key: string;
  name: string;
  description: string;
  placeholder: string;
  models: string;
}

const PROVIDERS: PresetProvider[] = [
  { key: 'openai',    name: 'OpenAI',      description: 'GPT-4o, o1, o3 等',           placeholder: 'sk-...',     models: 'gpt-4o, o1, o3-mini' },
  { key: 'anthropic', name: 'Anthropic',   description: 'Claude 4, Sonnet, Haiku 等',  placeholder: 'sk-ant-...', models: 'claude-sonnet-4-20250514' },
  { key: 'deepseek',  name: 'DeepSeek',    description: 'V4旗舰/快速, V3, R1推理',     placeholder: 'sk-...',     models: 'deepseek-v4-pro, deepseek-v4-flash, deepseek-chat' },
  { key: 'qwen',      name: '通义千问',     description: '阿里云，Qwen 系列模型',        placeholder: 'sk-...',     models: 'qwen-plus, qwen-turbo, qwen-max' },
  { key: 'kimi',      name: 'Kimi',        description: 'Moonshot AI，长文本理解',       placeholder: 'sk-...',     models: 'moonshot-v1-8k, moonshot-v1-128k' },
  { key: 'glm',       name: '智谱 GLM',    description: '智谱 AI，GLM 系列模型',        placeholder: '...',        models: 'glm-5.1, glm-4' },
  { key: 'doubao',    name: '豆包',        description: '字节跳动，豆包大模型 (Responses API)',          placeholder: '...',        models: 'doubao-seed-2-0-pro-260215' },
  { key: 'baidu',     name: '百度千帆',     description: '百度，文心一言/ERNIE 系列',     placeholder: '...',        models: 'ernie-4.0-8k, ernie-speed-8k' },
  { key: 'tencent',   name: '腾讯混元',     description: '腾讯云，混元大模型',           placeholder: '...',        models: 'hunyuan-pro, hunyuan-lite' },
  { key: 'minimax',   name: 'MiniMax',     description: 'MiniMax，abab 系列模型',       placeholder: '...',        models: 'abab6.5s-chat, abab5.5-chat' },
];

/* ─── Shared helpers ─── */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h4 className="text-xs font-medium text-cp-text-dim/70 uppercase tracking-wider">{title}</h4>
      <div className="flex-1 h-px bg-cp-border/20" />
    </div>
  );
}

function InlineEdit({
  value,
  onSave,
  placeholder,
  masked,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  masked?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const display = masked && value && !editing
    ? value.slice(0, 6) + '...' + value.slice(-4)
    : value;

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-sm flex-1 truncate ${value ? 'text-cp-text' : 'text-cp-text-dim/30'}`}>
          {display || placeholder || '(未设置)'}
        </span>
        <button
          onClick={() => { setEditing(true); setDraft(value); }}
          className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:text-cp-text hover:bg-white/10 transition-colors shrink-0"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSave(draft); setEditing(false); }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-2.5 py-1 text-sm text-cp-text outline-none focus:border-cp-accent"
        placeholder={placeholder}
        autoFocus
      />
      <button
        onClick={() => { onSave(draft); setEditing(false); }}
        className="text-[11px] px-2 py-0.5 rounded bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors shrink-0"
      >
        Save
      </button>
      <button
        onClick={() => setEditing(false)}
        className="text-[11px] px-2 py-0.5 rounded text-cp-text-dim hover:text-cp-text transition-colors shrink-0"
      >
        Cancel
      </button>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mt-1.5">
      <label className="text-xs text-cp-text-dim/60 w-[80px] shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ─── Types ─── */

interface ModelTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
  saving: string | null;
  setConfig: (updater: (c: Record<string, any>) => Record<string, any>) => void;
}

/* ─── Main ─── */

export function ModelTab({ config, saveKey, saving, setConfig }: ModelTabProps) {
  return (
    <div className="space-y-8">
      {/* ── 本地模型 ── */}
      <div>
        <SectionHeader title="本地模型" />
        <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 mb-3">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-2 h-2 rounded-full shrink-0 bg-green-500" />
            <span className="text-sm text-cp-text font-medium">Ollama</span>
            <span className="text-[11px] text-cp-text-dim/50 ml-auto">免费本地模型，需先安装 ollama</span>
          </div>
          <FieldRow label="Base URL">
            <InlineEdit
              value={config?.ollama?.baseUrl || 'http://localhost:11434'}
              onSave={(v) => saveKey('ollama.baseUrl', v)}
              placeholder="http://localhost:11434"
            />
          </FieldRow>
        </div>
      </div>

      {/* ── 云端模型 ── */}
      <div>
        <SectionHeader title="云端模型" />
        {PROVIDERS.map((p) => {
          const apiKey = config?.apiKeys?.[p.key] || '';
          return (
            <div key={p.key} className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 mb-3">
              <div className="flex items-center gap-2.5 mb-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${apiKey ? 'bg-green-500' : 'bg-white/15'}`} />
                <span className="text-sm text-cp-text font-medium">{p.name}</span>
                <span className="text-[11px] text-cp-text-dim/50 ml-auto">{p.description}</span>
              </div>
              <FieldRow label="API Key">
                <InlineEdit
                  value={apiKey}
                  onSave={(v) => saveKey(`apiKeys.${p.key}`, v)}
                  placeholder={p.placeholder}
                  masked
                />
              </FieldRow>
              <p className="text-[10px] text-cp-text-dim/30 mt-1.5 ml-[92px]">
                模型: {p.models}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── 自定义 API ── */}
      <div>
        <SectionHeader title="自定义 API" />
        <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${config?.custom?.baseUrl ? 'bg-green-500' : 'bg-white/15'}`} />
            <span className="text-sm text-cp-text font-medium">{config?.custom?.name || '自定义 API'}</span>
            <span className="text-[11px] text-cp-text-dim/50 ml-auto">OpenAI 兼容的第三方 / 本地推理引擎</span>
          </div>
          <FieldRow label="名称">
            <InlineEdit
              value={config?.custom?.name || ''}
              onSave={(v) => saveKey('custom.name', v)}
              placeholder="自定义 API"
            />
          </FieldRow>
          <FieldRow label="Base URL">
            <InlineEdit
              value={config?.custom?.baseUrl || ''}
              onSave={(v) => saveKey('custom.baseUrl', v)}
              placeholder="https://api.example.com/v1"
            />
          </FieldRow>
          <FieldRow label="API Key">
            <InlineEdit
              value={config?.custom?.apiKey || ''}
              onSave={(v) => saveKey('custom.apiKey', v)}
              placeholder="sk-..."
              masked
            />
          </FieldRow>
          <p className="text-[10px] text-cp-text-dim/30 mt-2 ml-[92px]">
            适用于 LM Studio、llama.cpp server 或其他 OpenAI 兼容 API
          </p>
        </div>
      </div>

      {/* ── 生成参数 ── */}
      <div>
        <SectionHeader title="生成参数" />
        <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 space-y-3">
          <FieldRow label="模型">
            <InlineEdit
              value={config?.model || ''}
              onSave={(v) => {
                saveKey('model', v);
                useModelStore.getState().loadCurrentConfig();
              }}
              placeholder="ollama:gemma4:e4b"
            />
          </FieldRow>
          <p className="text-[10px] text-cp-text-dim/40 ml-[92px] leading-relaxed">
            格式: provider:model<br />
            ollama:llama3.2 | openai:gpt-4o | anthropic:claude-sonnet-4-20250514 | deepseek:deepseek-v4-pro<br />
            qwen:qwen-plus | kimi:moonshot-v1-128k | glm:glm-5.1 | custom:model-name
          </p>

          <FieldRow label="温度">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config?.temperature ?? 0.3}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setConfig((c) => ({ ...c, temperature: val }));
                }}
                onMouseUp={(e) => saveKey('temperature', parseFloat((e.target as HTMLInputElement).value))}
                className="flex-1 accent-cp-accent h-1"
              />
              <span className="text-xs text-cp-text-dim tabular-nums w-8 text-right">
                {config?.temperature ?? 0.3}
              </span>
            </div>
          </FieldRow>

          <FieldRow label="最大 Token">
            <InlineEdit
              value={String(config?.maxResponseTokens ?? 4096)}
              onSave={(v) => saveKey('maxResponseTokens', parseInt(v) || 4096)}
              placeholder="4096"
            />
          </FieldRow>
        </div>
      </div>
    </div>
  );
}
