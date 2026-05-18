import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
  copied: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

/**
 * ErrorBoundary — catches React rendering errors to prevent white-screen crashes.
 * v2: retry with limit (3 max), disk logging, copy-to-clipboard, exponential backoff hint.
 */
export class ErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Preserve retryCount when a new error triggers (don't reset to 0 on re-crash)
    return { hasError: true, error, isRetrying: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] React render error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    const prevRetryCount = this.state.retryCount;
    this.setState({ errorInfo });

    // Attempt to write error log to disk for production diagnostics
    this.writeErrorLog(error, errorInfo, prevRetryCount);
  }

  componentWillUnmount(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /** Persist error details to .lingjing/error-log.json for offline debugging */
  writeErrorLog(error: Error, errorInfo: ErrorInfo, retryCount: number): void {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 2000) || 'No stack',
        },
        componentStack: errorInfo.componentStack?.substring(0, 2000) || 'No component stack',
        retryCount,
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Try writing via Electron API if available, then fallback to console
      const fs = window.electronAPI?.fs;
      if (fs?.writeFile) {
        fs.writeFile('.lingjing/error-log.json', JSON.stringify(logEntry, null, 2)).catch(() => {
          console.log('[ErrorBoundary] Error log (fallback):', JSON.stringify(logEntry));
        });
      } else {
        console.log('[ErrorBoundary] Error log:', JSON.stringify(logEntry));
      }
    } catch {
      // Silently ignore logging failures — don't compound the crash
    }
  }

  handleRetry = () => {
    const { retryCount } = this.state;

    if (retryCount >= MAX_RETRIES) {
      // Should not happen — button is hidden beyond MAX_RETRIES
      return;
    }

    // Delay before retry to avoid instant re-crash loop and let React reconciler settle
    this.setState({ isRetrying: true });
    this.retryTimer = setTimeout(() => {
      this.setState((prev) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prev.retryCount + 1,
        isRetrying: false,
        copied: false,
      }));
    }, RETRY_DELAY_MS);
  };

  handleFullReload = () => {
    window.location.reload();
  };

  handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const text = [
      `Error: ${error?.message || 'Unknown'}`,
      `Stack: ${error?.stack?.substring(0, 1000) || 'No stack'}`,
      `Component: ${errorInfo?.componentStack?.substring(0, 1000) || 'No component stack'}`,
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback: select from a hidden textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { retryCount, isRetrying, copied, error, errorInfo } = this.state;
      const canRetry = retryCount < MAX_RETRIES;
      const retriesLeft = MAX_RETRIES - retryCount;

      return (
        <div className="h-screen w-screen bg-cp-panel flex items-center justify-center select-none">
          <div className="text-center px-8 max-w-md">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-cp-text mb-2">
              界面渲染异常
            </h1>
            <p className="text-gray-400 text-sm mb-2">
              灵境遇到渲染错误，请尝试恢复
            </p>

            {/* Retry indicator */}
            {retryCount > 0 && (
              <p className="text-yellow-500 text-xs mb-2">
                已重试 {retryCount}/{MAX_RETRIES} 次
                {canRetry ? `（还剩 ${retriesLeft} 次）` : ' — 建议刷新页面'}
              </p>
            )}

            <details className="text-left mb-4">
              <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-300">
                查看错误详情
              </summary>
              <pre className="mt-2 p-3 bg-cp-editor rounded text-xs text-red-400 overflow-auto max-h-32 whitespace-pre-wrap">
                {error?.message || 'Unknown error'}
                {'\n\n'}
                {errorInfo?.componentStack?.substring(0, 500) || 'No component stack'}
              </pre>
            </details>

            <div className="flex gap-3 justify-center flex-wrap">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  disabled={isRetrying}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRetrying ? '重试中...' : `重试渲染 (${retriesLeft})`}
                </button>
              )}
              <button
                onClick={this.handleFullReload}
                className="px-4 py-2 bg-gray-700 text-gray-200 rounded text-sm hover:bg-gray-600 transition-colors"
              >
                刷新页面
              </button>
              <button
                onClick={this.handleCopyError}
                className="px-3 py-2 bg-cp-panel text-gray-400 rounded text-xs hover:bg-cp-tab-inactive hover:text-gray-200 transition-colors"
              >
                {copied ? '✓ 已复制' : '📋 复制错误'}
              </button>
            </div>

            {/* After max retries: guidance */}
            {!canRetry && (
              <p className="text-gray-500 text-xs mt-3">
                多次重试无效，错误日志已保存到 .lingjing/error-log.json
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
