import React, { useState, useEffect, useRef } from 'react';

interface BrowserState {
  status: 'closed' | 'ready' | 'navigated' | 'active' | 'shutdown';
  currentUrl: string | null;
  pageTitle: string | null;
  lastScreenshot: string | null;
  lastActivity: number;
}

export function BrowserPanel() {
  const [browserState, setBrowserState] = useState<BrowserState>({
    status: 'closed',
    currentUrl: null,
    pageTitle: null,
    lastScreenshot: null,
    lastActivity: Date.now(),
  });
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const screenshotRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Listen for browser events
    const cleanupScreenshot = window.electronAPI.browser.onScreenshot((data) => {
      setBrowserState((prev) => ({
        ...prev,
        lastScreenshot: data.image,
        currentUrl: data.url,
        pageTitle: data.title,
      }));
      setIsLoading(false);
    });

    const cleanupStatus = window.electronAPI.browser.onStatus((data) => {
      setBrowserState(data);
      setIsLoading(false);
    });

    const cleanupError = window.electronAPI.browser.onError((data) => {
      setError(data.error);
      setIsLoading(false);
    });

    return () => {
      cleanupScreenshot();
      cleanupStatus();
      cleanupError();
    };
  }, []);

  const handleInitialize = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.browser.initialize();
      if (result.success) {
        setBrowserState(result.state);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = async (url: string) => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.browser.execute('navigate', { url });
      if (result.success) {
        setUrlInput(url);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.browser.execute('goBack', {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoForward = async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.browser.execute('goForward', {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleShutdown = async () => {
    try {
      await window.electronAPI.browser.shutdown();
      setBrowserState({
        status: 'shutdown',
        currentUrl: null,
        pageTitle: null,
        lastScreenshot: null,
        lastActivity: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const statusColor = {
    closed: 'text-gray-500',
    ready: 'text-green-500',
    navigated: 'text-blue-500',
    active: 'text-yellow-500',
    shutdown: 'text-red-500',
  }[browserState.status];

  return (
    <div className="flex flex-col h-full bg-cp-panel border-t border-cp-border">
      {/* Navigation bar */}
      <div className="flex items-center gap-2 p-2 border-b border-cp-border">
        <button
          onClick={handleGoBack}
          disabled={browserState.status === 'closed' || isLoading}
          className="px-2 py-1 text-sm bg-cp-tab-inactive hover:bg-cp-panel disabled:opacity-50 rounded"
          title="Go Back"
        >
          ←
        </button>
        <button
          onClick={handleGoForward}
          disabled={browserState.status === 'closed' || isLoading}
          className="px-2 py-1 text-sm bg-cp-tab-inactive hover:bg-cp-panel disabled:opacity-50 rounded"
          title="Go Forward"
        >
          →
        </button>
        <button
          onClick={handleInitialize}
          disabled={browserState.status !== 'closed' && browserState.status !== 'shutdown'}
          className="px-3 py-1 text-sm bg-cp-tab-inactive hover:bg-cp-panel disabled:opacity-50 rounded"
        >
          Initialize
        </button>
        <button
          onClick={handleShutdown}
          disabled={browserState.status === 'closed' || browserState.status === 'shutdown'}
          className="px-3 py-1 text-sm bg-cp-tab-inactive hover:bg-cp-panel disabled:opacity-50 rounded"
        >
          Shutdown
        </button>
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNavigate(urlInput);
              }
            }}
            placeholder="Enter URL and press Enter"
            className="flex-1 px-3 py-1 text-sm bg-cp-tab-inactive border border-cp-border rounded text-cp-text placeholder-gray-500 focus:outline-none focus:border-blue-500"
            disabled={browserState.status === 'closed'}
          />
          <button
            onClick={() => handleNavigate(urlInput)}
            disabled={browserState.status === 'closed' || isLoading}
            className="px-4 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-white"
          >
            Go
          </button>
        </div>
        <div className={`text-xs font-medium ${statusColor}`}>
          {browserState.status.toUpperCase()}
        </div>
      </div>

      {/* Page info */}
      {browserState.pageTitle && (
        <div className="px-3 py-1 text-xs text-gray-400 border-b border-cp-border">
          {browserState.pageTitle}
          {browserState.currentUrl && (
            <span className="ml-2 text-cp-text-dim">{browserState.currentUrl}</span>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 text-sm text-red-500 bg-red-900/20 border-b border-red-900/50">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}

      {/* Screenshot viewer */}
      <div className="flex-1 overflow-auto bg-cp-panel flex items-center justify-center">
        {browserState.lastScreenshot ? (
          <img
            ref={screenshotRef}
            src={browserState.lastScreenshot}
            alt="Browser Screenshot"
            className="max-w-full h-auto"
          />
        ) : (
          <div className="text-center text-gray-500">
            <div className="text-6xl mb-4">🖥️</div>
            <p className="text-sm">No screenshot yet</p>
            <p className="text-xs mt-2">
              {browserState.status === 'closed' || browserState.status === 'shutdown'
                ? 'Click "Initialize" to start the browser'
                : 'Use the browser_screenshot tool to capture'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
