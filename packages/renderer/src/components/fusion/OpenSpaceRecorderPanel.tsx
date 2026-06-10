import React, { useEffect, useState } from 'react';
import { useOpenSpaceStore } from '../../stores/openspace-store';

const stateLabels: Record<string, string> = {
  idle: '就绪',
  recording: '录制中',
  paused: '已暂停',
};

const stateColors: Record<string, string> = {
  idle: 'text-gray-400',
  recording: 'text-red-400 animate-pulse',
  paused: 'text-yellow-400',
};

export function OpenSpaceRecorderPanel() {
  const {
    recordingState, recordingSessions, currentSessionId, runState,
    startRecording, stopRecording, pauseRecording, listRecordingSessions,
  } = useOpenSpaceStore();

  const [fps, setFps] = useState(30);
  const [resolution, setResolution] = useState('1920x1080');
  const [format, setFormat] = useState<'png' | 'jpg'>('png');

  useEffect(() => {
    listRecordingSessions();
  }, []);

  const handleStart = async () => {
    const [w, h] = resolution.split('x').map(Number);
    await startRecording({ fps, resolution: [w, h], format });
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-200">会话录制</h2>
        <span className={`text-xs font-medium ${stateColors[recordingState] || 'text-gray-400'}`}>
          {stateLabels[recordingState] || recordingState}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Recording config */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2">
          <span className="text-xs font-medium text-gray-300">录制参数</span>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">帧率</span>
            <input
              type="number"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value) || 30)}
              min={1}
              max={120}
              className="w-20 rounded bg-gray-900 border border-gray-600 px-2 py-0.5 text-xs text-gray-200 text-right"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">分辨率</span>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="rounded bg-gray-900 border border-gray-600 px-2 py-0.5 text-xs text-gray-200"
            >
              <option value="1920x1080">1920×1080 (Full HD)</option>
              <option value="2560x1440">2560×1440 (2K)</option>
              <option value="3840x2160">3840×2160 (4K)</option>
              <option value="1280x720">1280×720 (HD)</option>
              <option value="640x480">640×480</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">格式</span>
            <div className="flex gap-1">
              {(['png', 'jpg'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    format === f ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recording controls */}
        <div className="flex gap-2">
          {recordingState === 'idle' ? (
            <button
              onClick={handleStart}
              disabled={runState !== 'running'}
              className="flex-1 rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              🔴 开始录制
            </button>
          ) : (
            <>
              <button
                onClick={() => stopRecording()}
                className="flex-1 rounded bg-gray-600 px-3 py-2 text-xs font-medium text-white hover:bg-gray-500"
              >
                ⏹ 停止
              </button>
              <button
                onClick={() => pauseRecording()}
                className="flex-1 rounded bg-yellow-600 px-3 py-2 text-xs font-medium text-white hover:bg-yellow-500"
              >
                ⏸ 暂停
              </button>
            </>
          )}
        </div>

        {/* Session history */}
        <div>
          <span className="text-xs font-medium text-gray-300">录制历史</span>
          {recordingSessions.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500">无录制记录</p>
          ) : (
            <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
              {recordingSessions.map((session) => {
                const duration = session.endTime ? session.endTime - session.startTime : 0;
                const isActive = session.id === currentSessionId;
                return (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between rounded border px-2 py-1 text-xs ${
                      isActive ? 'border-green-600/50 bg-green-900/20' : 'border-gray-700 bg-gray-800'
                    }`}
                  >
                    <div>
                      <span className="text-gray-200">{session.id}</span>
                      <span className="ml-2 text-gray-500">
                        {duration > 0 ? formatDuration(duration) : '进行中'}
                      </span>
                    </div>
                    <span className="text-gray-500">{session.frameCount} 帧</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
