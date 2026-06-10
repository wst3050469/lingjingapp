import React from 'react';
import { useOpenSpaceStore } from '../../stores/openspace-store';

export function OpenSpaceInstallGuide() {
  const { installation, installGuideVisible, setInstallGuideVisible, setManualPath, detectInstallation } = useOpenSpaceStore();

  if (!installGuideVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-200">OpenSpace 安装指南</h2>
          <button
            onClick={() => setInstallGuideVisible(false)}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs text-gray-300">
          <div>
            <p className="font-medium text-gray-200">系统要求</p>
            <ul className="mt-1 ml-4 list-disc space-y-0.5 text-gray-400">
              <li>Windows 10/11 x64 或 Linux x64</li>
              <li>OpenGL 4.6 兼容显卡</li>
              <li>8GB+ RAM，10GB+ 磁盘空间</li>
              <li>OpenSpace v0.19.0 或更高版本</li>
            </ul>
          </div>

          <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-2">
            <p className="text-red-400 font-medium">⚠️ macOS 不支持</p>
            <p className="mt-0.5 text-gray-400">Apple Silicon 不兼容 OpenGL 4.6，仅支持 Windows/Linux x64</p>
          </div>

          <div>
            <p className="font-medium text-gray-200">安装步骤</p>
            <ol className="mt-1 ml-4 list-decimal space-y-0.5 text-gray-400">
              <li>从{' '}
                <a
                  href="https://github.com/OpenSpace/OpenSpace/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  OpenSpace GitHub Releases
                </a>
                {' '}下载最新版
              </li>
              <li>运行安装程序，记下安装路径</li>
              <li>在下方输入安装路径后点击"自动检测"</li>
            </ol>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="block text-xs text-gray-400">手动设置安装路径</label>
          <div className="flex gap-2">
            <input
              type="text"
              defaultValue={installation?.path || ''}
              placeholder="C:\Program Files\OpenSpace"
              className="flex-1 rounded bg-gray-800 border border-gray-600 px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setManualPath((e.target as HTMLInputElement).value);
                }
              }}
            />
            <button
              onClick={() => {
                const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                if (input?.value) setManualPath(input.value);
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
            >
              设置
            </button>
          </div>

          <button
            onClick={() => detectInstallation()}
            className="w-full rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-500"
          >
            自动检测 OpenSpace 安装
          </button>
        </div>

        <button
          onClick={() => setInstallGuideVisible(false)}
          className="mt-4 w-full rounded bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
