// Inline Chat Widget - React component rendered inside a Monaco ViewZone
// Provides the input UI for inline chat interactions

import { useState, useRef, useEffect, useCallback } from 'react';

interface InlineChatWidgetProps {
  scenario: 'modify' | 'add';
  isGenerating: boolean;
  onSubmit: (prompt: string, contextFiles: string[]) => void;
  onDismiss: () => void;
  openFiles: Array<{ path: string; name: string }>;
}

export function InlineChatWidget({
  scenario,
  isGenerating,
  onSubmit,
  onDismiss,
  openFiles,
}: InlineChatWidgetProps) {
  const [text, setText] = useState('');
  const [contextFiles, setContextFiles] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus on mount
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  const handleSubmit = useCallback(() => {
    if (!text.trim() || isGenerating) return;
    onSubmit(text.trim(), contextFiles);
  }, [text, contextFiles, isGenerating, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showMentions) {
          setShowMentions(false);
        } else {
          onDismiss();
        }
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
    },
    [handleSubmit, onDismiss, showMentions],
  );

  const handleMentionSelect = useCallback(
    (filePath: string) => {
      if (!contextFiles.includes(filePath)) {
        setContextFiles((prev) => [...prev, filePath]);
      }
      setShowMentions(false);
      setMentionFilter('');
      inputRef.current?.focus();
    },
    [contextFiles],
  );

  const handleRemoveContext = useCallback((filePath: string) => {
    setContextFiles((prev) => prev.filter((f) => f !== filePath));
  }, []);

  const filteredFiles = openFiles.filter((f) =>
    f.name.toLowerCase().includes(mentionFilter.toLowerCase()),
  );

  return (
    <div
      style={{
        background: '#252526',
        border: '1px solid #3c3c3c',
        borderRadius: '8px',
        padding: '8px 12px',
        margin: '4px 48px 4px 48px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '13px',
        position: 'relative',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}
      >
        <span style={{ color: '#7cacf8', fontSize: '11px', fontWeight: 500 }}>
          {scenario === 'modify' ? '\u884c\u95f4\u4f1a\u8bdd - \u4fee\u6539\u4ee3\u7801' : '\u884c\u95f4\u4f1a\u8bdd - \u6dfb\u52a0\u4ee3\u7801'}
        </span>
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#808080',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0 4px',
            lineHeight: 1,
          }}
          title="\u5173\u95ed (Esc)"
        >
          \u00d7
        </button>
      </div>

      {/* Context chips */}
      {contextFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
          {contextFiles.map((f) => (
            <span
              key={f}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '1px 6px',
                background: 'rgba(122, 172, 248, 0.12)',
                border: '1px solid rgba(122, 172, 248, 0.2)',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#7cacf8',
              }}
            >
              @{f.split(/[/\\]/).pop()}
              <button
                onClick={() => handleRemoveContext(f)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7cacf8',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                \u00d7
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
        {/* @ mention button */}
        <button
          onClick={() => setShowMentions(!showMentions)}
          style={{
            background: showMentions ? 'rgba(122, 172, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            color: showMentions ? '#7cacf8' : '#808080',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '4px 8px',
            flexShrink: 0,
            height: '28px',
          }}
          title="@ \u63d0\u53ca\u6587\u4ef6"
        >
          @
        </button>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            scenario === 'modify'
              ? '\u63cf\u8ff0\u5982\u4f55\u4fee\u6539\u9009\u4e2d\u7684\u4ee3\u7801... (Enter \u53d1\u9001, Esc \u5173\u95ed)'
              : '\u63cf\u8ff0\u8981\u6dfb\u52a0\u7684\u4ee3\u7801... (Enter \u53d1\u9001, Esc \u5173\u95ed)'
          }
          disabled={isGenerating}
          rows={1}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            color: '#cccccc',
            fontSize: '13px',
            padding: '4px 8px',
            resize: 'none',
            outline: 'none',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            minHeight: '28px',
            maxHeight: '120px',
          }}
        />

        {/* Submit / Loading */}
        {isGenerating ? (
          <div
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(122, 172, 248, 0.3)',
                borderTopColor: '#7cacf8',
                borderRadius: '50%',
                animation: 'inline-chat-spin 0.8s linear infinite',
              }}
            />
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            style={{
              background: text.trim() ? '#2563eb' : 'rgba(37, 99, 235, 0.3)',
              border: 'none',
              borderRadius: '4px',
              color: text.trim() ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
              cursor: text.trim() ? 'pointer' : 'default',
              fontSize: '12px',
              padding: '4px 12px',
              flexShrink: 0,
              height: '28px',
              fontWeight: 500,
            }}
          >
            {'\u53d1\u9001'}
          </button>
        )}
      </div>

      {/* @ Mention dropdown */}
      {showMentions && (
        <div
          style={{
            position: 'absolute',
            left: '12px',
            right: '12px',
            bottom: '100%',
            marginBottom: '4px',
            background: '#1e1e1e',
            border: '1px solid #3c3c3c',
            borderRadius: '6px',
            maxHeight: '150px',
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          <input
            value={mentionFilter}
            onChange={(e) => setMentionFilter(e.target.value)}
            placeholder="\u641c\u7d22\u6587\u4ef6..."
            autoFocus
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#cccccc',
              fontSize: '12px',
              padding: '6px 8px',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setShowMentions(false);
              }
            }}
          />
          {filteredFiles.length > 0 ? (
            filteredFiles.map((f) => (
              <div
                key={f.path}
                onClick={() => handleMentionSelect(f.path)}
                style={{
                  padding: '4px 8px',
                  cursor: 'pointer',
                  color: '#cccccc',
                  fontSize: '12px',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.06)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLDivElement).style.background = 'transparent';
                }}
              >
                {f.name}
                <span style={{ color: '#808080', marginLeft: '8px', fontSize: '11px' }}>
                  {f.path}
                </span>
              </div>
            ))
          ) : (
            <div style={{ padding: '8px', color: '#808080', fontSize: '12px', textAlign: 'center' }}>
              {'\u6ca1\u6709\u6253\u5f00\u7684\u6587\u4ef6'}
            </div>
          )}
        </div>
      )}

      {/* Inline spinner animation */}
      <style>{`
        @keyframes inline-chat-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
