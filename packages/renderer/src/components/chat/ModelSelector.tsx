import { useEffect, useRef, useState } from 'react';
import { useModelStore } from '../../stores/model-store';

// Color mapping for provider dots (Tailwind classes can't be dynamic, use inline styles)
const COLOR_MAP: Record<string, string> = {
  green: '#22c55e', blue: '#3b82f6', orange: '#f97316', cyan: '#06b6d4',
  purple: '#a855f7', pink: '#ec4899', teal: '#14b8a6', rose: '#f43f5e',
  red: '#ef4444', sky: '#0ea5e9', amber: '#f59e0b', gray: '#6b7280',
};

export function ModelSelector() {
  const {
    currentModel, ollamaModels, ollamaConnected, configuredProviders,
    loading, fetchOllamaModels, setModel, loadCurrentConfig,
  } = useModelStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCurrentConfig();
    fetchOllamaModels();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Determine display name and color
  const provider = currentModel?.split(':')[0] || '';
  const modelName = currentModel ? currentModel.slice(currentModel.indexOf(':') + 1) : '';
  const displayModel = modelName || 'Select model';

  const providerInfo = configuredProviders.find((p) => p.key === provider);
  const dotColor = provider === 'ollama' ? COLOR_MAP.green
    : providerInfo ? (COLOR_MAP[providerInfo.color] || COLOR_MAP.gray)
    : COLOR_MAP.gray;

  const handleSelect = async (model: string) => {
    await setModel(model);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) {
            fetchOllamaModels();
            loadCurrentConfig();
          }
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-cp-text-dim hover:text-cp-text hover:bg-white/5 transition-colors"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
        <span className="truncate max-w-[200px]">{displayModel}</span>
        <span className="text-xs">&#9662;</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-cp-panel border border-cp-border rounded-lg shadow-xl z-50 max-h-[500px] overflow-y-auto">
          {/* Ollama */}
          <ProviderSection name="Ollama" color={COLOR_MAP.green} connected={ollamaConnected}>
            {loading && (
              <div className="px-3 py-2 text-xs text-cp-text-dim">Loading...</div>
            )}
            {!loading && ollamaModels.length === 0 && (
              <div className="px-3 py-2 text-xs text-cp-text-dim">
                {ollamaConnected ? 'No models. Run: ollama pull llama3.2' : 'Start Ollama first'}
              </div>
            )}
            {ollamaModels.map((name) => (
              <ModelItem
                key={name}
                name={name}
                fullName={`ollama:${name}`}
                selected={currentModel === `ollama:${name}`}
                onSelect={handleSelect}
              />
            ))}
          </ProviderSection>

          {/* Dynamic cloud providers (only those with API keys configured) */}
          {configuredProviders.map((p) => (
            <ProviderSection
              key={p.key}
              name={p.name}
              color={COLOR_MAP[p.color] || COLOR_MAP.gray}
            >
              {p.models.map((name) => (
                <ModelItem
                  key={name}
                  name={name}
                  fullName={`${p.key}:${name}`}
                  selected={currentModel === `${p.key}:${name}`}
                  onSelect={handleSelect}
                />
              ))}
            </ProviderSection>
          ))}

          {/* Manual input */}
          <div className="px-3 py-2 border-t border-cp-border">
            <p className="text-[10px] text-cp-text-dim/60 mb-1">手动输入:</p>
            <input
              type="text"
              defaultValue={currentModel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSelect((e.target as HTMLInputElement).value);
              }}
              className="w-full bg-cp-bg border border-cp-border rounded px-2 py-1 text-xs text-cp-text outline-none focus:border-cp-accent"
              placeholder="provider:model"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderSection({ name, color, connected, children }: {
  name: string;
  color: string;
  connected?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-3 py-1.5 text-[10px] text-cp-text-dim uppercase tracking-wide border-b border-cp-border/50 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        {name}
        {connected !== undefined && (
          <span className="ml-auto text-[9px]">{connected ? 'Connected' : 'Offline'}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function ModelItem({ name, fullName, selected, onSelect }: {
  name: string;
  fullName: string;
  selected: boolean;
  onSelect: (model: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(fullName)}
      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition-colors flex items-center
        ${selected ? 'text-cp-accent' : 'text-cp-text'}`}
    >
      <span className="truncate">{name}</span>
      {selected && <span className="ml-auto text-xs flex-shrink-0">&#10003;</span>}
    </button>
  );
}
