import { useState, useEffect } from 'react';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-medium text-cp-text-dim uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

export function ProviderBlock({ name, description, connected, children }: {
  name: string;
  description: string;
  connected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.02] border border-cp-border/50 rounded-lg p-3 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-cp-text-dim/30'}`} />
        <span className="text-sm text-cp-text font-medium">{name}</span>
        <span className="text-[10px] text-cp-text-dim/60 ml-auto">{description}</span>
      </div>
      {children}
    </div>
  );
}

export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <label className="text-xs text-cp-text-dim w-[80px] flex-shrink-0">{label}</label>
      {children}
    </div>
  );
}

export function EditableField({ value, onSave, saving, placeholder, masked }: {
  value: string;
  onSave: (v: string) => void;
  saving?: boolean;
  placeholder?: string;
  masked?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const displayValue = masked && value && !editing
    ? value.slice(0, 6) + '...' + value.slice(-4)
    : value;

  if (!editing) {
    return (
      <div className="flex-1 flex items-center gap-2">
        <span className={`text-sm flex-1 truncate ${value ? 'text-cp-text' : 'text-cp-text-dim/40'}`}>
          {displayValue || placeholder || '(not set)'}
        </span>
        <button
          onClick={() => { setEditing(true); setDraft(value); }}
          className="text-[10px] text-cp-accent hover:text-cp-accent/80 flex-shrink-0"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSave(draft); setEditing(false); }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="flex-1 bg-cp-bg border border-cp-border rounded px-2 py-1 text-sm text-cp-text outline-none focus:border-cp-accent"
        placeholder={placeholder}
        autoFocus
      />
      <button
        onClick={() => { onSave(draft); setEditing(false); }}
        disabled={!!saving}
        className="text-[10px] text-cp-accent hover:text-cp-accent/80 flex-shrink-0"
      >
        {saving ? '...' : 'Save'}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="text-[10px] text-cp-text-dim hover:text-cp-text flex-shrink-0"
      >
        Cancel
      </button>
    </div>
  );
}
