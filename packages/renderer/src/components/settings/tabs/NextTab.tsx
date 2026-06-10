import { useState } from 'react';
import { useNextStore } from '../../../stores/next-store';

/* --- Helper components (mirrors GeneralTab pattern) --- */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h4 className="text-xs font-medium text-cp-text-dim/70 uppercase tracking-wider">{title}</h4>
      <div className="flex-1 h-px bg-cp-border/20" />
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0 mr-4">
        <p className="text-sm text-cp-text">{title}</p>
        {description && <p className="text-[11px] text-cp-text-dim/50 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-green-500' : 'bg-white/10'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

/* --- Types --- */

interface NextTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

/* --- Main Component --- */

export function NextTab({ config, saveKey }: NextTabProps) {
  const nextConfig = config?.next || {};
  const nextStore = useNextStore();

  const [enabled, setEnabled] = useState<boolean>(nextConfig.enabled ?? true);
  const [triggerInComments, setTriggerInComments] = useState<boolean>(nextConfig.triggerInComments ?? true);
  const [autoImport, setAutoImport] = useState<boolean>(nextConfig.autoImport ?? true);
  const [debounceMs, setDebounceMs] = useState<number>(nextConfig.debounceMs ?? 500);
  const [disabledExts, setDisabledExts] = useState<string>(
    (nextConfig.disabledExtensions || []).join(', ')
  );

  const handleEnabled = (v: boolean) => {
    setEnabled(v);
    nextStore.setEnabled(v);
    saveKey('next.enabled', v);
  };

  const handleTriggerInComments = (v: boolean) => {
    setTriggerInComments(v);
    nextStore.setTriggerInComments(v);
    saveKey('next.triggerInComments', v);
  };

  const handleAutoImport = (v: boolean) => {
    setAutoImport(v);
    nextStore.setAutoImport(v);
    saveKey('next.autoImport', v);
  };

  const handleDebounceMs = (ms: number) => {
    const clamped = Math.max(100, Math.min(2000, ms));
    setDebounceMs(clamped);
    nextStore.setDebounceMs(clamped);
    saveKey('next.debounceMs', clamped);
  };

  const handleDisabledExts = (raw: string) => {
    setDisabledExts(raw);
    const exts = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('.'));
    nextStore.setDisabledExtensions(exts);
    saveKey('next.disabledExtensions', exts);
  };

  return (
    <div className="space-y-8">
      {/* --- Description --- */}
      <div>
        <SectionHeader title="NEXT" />
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-cp-accent/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-cp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-cp-text font-medium">NEXT 代码预测</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
                预测你的编码意图，生成下一段代码。NEXT 会分析当前上下文，智能补全代码块、函数体和逻辑片段。
                按 Tab 接受建议，Esc 拒绝。按住 Alt 键可预览完整修改。
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-cp-border/15">
            <SettingRow title="启用 NEXT" description="开启代码预测功能">
              <Toggle checked={enabled} onChange={handleEnabled} />
            </SettingRow>
          </div>
        </Card>
      </div>

      {/* --- Trigger Settings --- */}
      <div>
        <SectionHeader title="触发设置" />
        <Card>
          <SettingRow
            title="在注释中触发"
            description="允许 NEXT 在注释区域中触发，根据注释内容预测并生成对应代码"
          >
            <Toggle checked={triggerInComments} onChange={handleTriggerInComments} />
          </SettingRow>
          <div className="border-t border-cp-border/15">
            <SettingRow
              title="防抖延迟 (ms)"
              description="用户停止输入后等待多少毫秒再触发预测（100-2000）"
            >
              <input
                type="number"
                min={100}
                max={2000}
                step={50}
                value={debounceMs}
                onChange={(e) => handleDebounceMs(Number(e.target.value))}
                className="w-20 bg-cp-bg border border-cp-border/40 rounded px-2 py-1 text-xs text-cp-text text-right focus:outline-none focus:border-cp-accent/50"
              />
            </SettingRow>
          </div>
        </Card>
      </div>

      {/* --- Extension Exclusions --- */}
      <div>
        <SectionHeader title="文件类型排除" />
        <Card>
          <SettingRow
            title="排除的文件扩展名"
            description="逗号分隔的扩展名列表，这些文件类型不触发 NEXT"
          >
            <input
              type="text"
              value={disabledExts}
              onChange={(e) => handleDisabledExts(e.target.value)}
              placeholder=".md, .txt, .json"
              className="w-44 bg-cp-bg border border-cp-border/40 rounded px-2 py-1 text-xs text-cp-text focus:outline-none focus:border-cp-accent/50"
            />
          </SettingRow>
          <div className="mt-2 pt-2 border-t border-cp-border/15">
            <div className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 text-cp-text-dim/40 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11px] text-cp-text-dim/40 leading-relaxed">
                例如 .md, .txt, .json 等不需要代码预测的文件类型。扩展名必须以 . 开头。
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* --- Auto Import --- */}
      <div>
        <SectionHeader title="自动导入" />
        <Card>
          <SettingRow
            title="自动导入"
            description="自动导入 TypeScript、Python 和 Golang 所需的模块"
          >
            <Toggle checked={autoImport} onChange={handleAutoImport} />
          </SettingRow>
          <div className="mt-2 pt-2 border-t border-cp-border/15">
            <div className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 text-cp-text-dim/40 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11px] text-cp-text-dim/40 leading-relaxed">
                当 NEXT 生成的代码引用了尚未导入的模块时，会自动在文件顶部添加相应的 import 语句。
                目前支持 TypeScript/JavaScript (ES modules, CommonJS)、Python (import/from) 和 Go (import) 三种语言。
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* --- Keyboard shortcuts reference --- */}
      <div>
        <SectionHeader title="快捷键" />
        <Card>
          <div className="space-y-2">
            <ShortcutRow keys="Tab" description="接受当前代码建议" />
            <ShortcutRow keys="Esc" description="拒绝当前代码建议" />
            <ShortcutRow keys="Alt (按住)" description="预览完整修改 diff" />
            <ShortcutRow keys="Tab (连续)" description="跳转到下一个建议位置" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-cp-text-dim/50">{description}</span>
      <kbd className="px-1.5 py-0.5 bg-white/5 border border-cp-border/30 rounded text-[10px] text-cp-text-dim/70 font-mono">
        {keys}
      </kbd>
    </div>
  );
}
