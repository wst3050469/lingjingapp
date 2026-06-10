import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import './styles/global.css';

// ── ElectronAPI presence check (iter4-startup-fix) ──
// If electronAPI is missing, render a diagnostic page instead of crashing.
const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<div style="color:red;padding:20px;font-family:monospace">Fatal: #root element not found</div>';
} else if (!(window as any).electronAPI) {
  console.error('[Renderer] window.electronAPI is missing — preload may have failed');
  rootEl.innerHTML = `<div style="background:#1e1e1e;color:#cd3131;font-family:monospace;padding:40px;height:100vh;box-sizing:border-box">
    <h2 style="font-size:18px">灵境 IDE — 渲染进程初始化失败</h2>
    <p>window.electronAPI 不可用，preload 脚本可能未正确加载。</p>
    <hr style="border-color:#444" />
    <p style="font-size:13px">可能原因：</p>
    <ul style="font-size:13px">
      <li>preload.js 文件缺失或路径错误</li>
      <li>Electron 版本不兼容</li>
      <li>安全策略 (CSP) 阻止了 contextBridge</li>
    </ul>
    <p style="font-size:13px">修复建议：</p>
    <ul style="font-size:13px">
      <li>重新安装灵境 IDE</li>
      <li>检查 ~/.lingjing/ 目录权限</li>
      <li>联系技术支持</li>
    </ul>
  </div>`;
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
