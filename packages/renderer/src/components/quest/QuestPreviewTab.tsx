// Quest Preview Tab - live preview iframe with URL suggestions and persistence

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuestStore } from '../../stores/quest-store';

const COMMON_URLS = [
  { label: 'localhost:3000', url: 'http://localhost:3000' },
  { label: 'localhost:5173', url: 'http://localhost:5173' },
  { label: 'localhost:8080', url: 'http://localhost:8080' },
  { label: 'localhost:4200', url: 'http://localhost:4200' },
  { label: 'localhost:8000', url: 'http://localhost:8000' },
];

const STORAGE_KEY = 'quest_preview_url';

function getSavedUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'http://localhost:3000';
  } catch {
    return 'http://localhost:3000';
  }
}

function saveUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url);
  } catch { /* ignore */ }
}

export function QuestPreviewTab() {
  const [url, setUrl] = useState(getSavedUrl);
  const [loadedUrl, setLoadedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { isStreaming, messages, previewUrl } = useQuestStore();
  const hasAgentRun = messages.length > 0;

  // Auto-load preview URL when AI outputs a localhost URL
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (previewUrl && !autoLoadedRef.current) {
      setUrl(previewUrl);
      setLoadedUrl(previewUrl);
      saveUrl(previewUrl);
      setIsLoading(true);
      autoLoadedRef.current = true;
    }
  }, [previewUrl]);

  // Close suggestions on outside click
  useEffect(() => {
    if (!showSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSuggestions]);

  const handleLoad = useCallback(() => {
    if (!url.trim()) return;
    const targetUrl = url.trim();
    setLoadedUrl(targetUrl);
    saveUrl(targetUrl);
    setIsLoading(true);
    setShowSuggestions(false);
    autoLoadedRef.current = true; // Mark as user-initiated
  }, [url]);

  const handleSuggestionClick = (suggestionUrl: string) => {
    setUrl(suggestionUrl);
    setLoadedUrl(suggestionUrl);
    saveUrl(suggestionUrl);
    setIsLoading(true);
    setShowSuggestions(false);
  };

  const handleReload = () => {
    if (iframeRef.current && loadedUrl) {
      setIsLoading(true);
      iframeRef.current.src = loadedUrl;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoad();
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* URL bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-cp-border/30">
        <button
          onClick={handleReload}
          disabled={!loadedUrl}
          className="w-6 h-6 flex items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
          title="Reload"
        >
          <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </button>
        <div className="flex-1 relative">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder="http://localhost:3000"
            className="w-full bg-white/5 border border-cp-border/30 rounded-md px-2.5 py-1 text-[11px] text-cp-text outline-none focus:border-white/30 transition-colors"
          />
          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-cp-panel border border-cp-border/60 rounded-lg shadow-xl z-[100] py-1"
            >
              <div className="px-3 py-1.5 text-[10px] text-white/60 uppercase tracking-wider">
                常用开发服务器
              </div>
              {COMMON_URLS.map((item) => (
                <button
                  key={item.url}
                  onClick={() => handleSuggestionClick(item.url)}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500/60 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleLoad}
          className="text-[10px] px-2.5 py-1 rounded-md bg-cp-accent/15 text-cp-accent hover:bg-cp-accent/25 transition-colors"
        >
          打开
        </button>
      </div>

      {/* Iframe area */}
      <div className="flex-1 relative bg-white">
        {!loadedUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-cp-bg">
            <svg className="w-10 h-10 text-white/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="text-white/70 text-[11px] mb-2">
              {isStreaming ? '等待预览地址...' : '预览尚未加载'}
            </div>
            <p className="text-white/60 text-[10px] max-w-[240px] text-center leading-relaxed">
              {isStreaming
                ? 'AI 正在构建应用，完成后在对话框查看端口信息，输入开发服务器地址进行实时预览。'
                : '输入开发服务器 URL 进行实时预览。AI 启动开发服务器后，对话框会显示端口信息，您可以在此输入对应的 URL。'
              }
            </p>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-cp-accent/30 z-10">
                <div className="h-full bg-cp-accent animate-pulse" style={{ width: '60%' }} />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={loadedUrl}
              onLoad={handleIframeLoad}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Quest Preview"
            />
          </>
        )}
      </div>
    </div>
  );
}
