import React, { useState, useEffect } from 'react';

interface Recording {
  id: string;
  name: string;
  duration: number;
  createdAt: string;
  framesCount: number;
}

export function OpenSpaceRecorderPanel() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const result = await (window as any).electron?.invoke('openspace:list-recordings');
      setRecordings(result || []);
    } catch { setRecordings([]); }
    setLoading(false);
  };

  const startRecording = async () => {
    try {
      await (window as any).electron?.invoke('openspace:start-recording');
      setIsRecording(true);
    } catch (err) { console.error('Start recording failed:', err); }
  };

  const stopRecording = async () => {
    try {
      await (window as any).electron?.invoke('openspace:stop-recording');
      setIsRecording(false);
      await loadRecordings();
    } catch (err) { console.error('Stop recording failed:', err); }
  };

  const playRecording = async (id: string) => {
    try {
      setCurrentRecordingId(id);
      setIsPlaying(true);
      await (window as any).electron?.invoke('openspace:play-recording', { recordingId: id });
      setIsPlaying(false);
      setCurrentRecordingId(null);
    } catch (err) {
      setIsPlaying(false);
      setCurrentRecordingId(null);
      console.error('Play recording failed:', err);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-cp-text">录制回放</h2>
        <div className="flex gap-2">
          {!isRecording ? (
            <button onClick={startRecording} className="px-3 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30">
              ⏺ 开始录制
            </button>
          ) : (
            <button onClick={stopRecording} className="px-3 py-1 text-xs rounded bg-red-500/40 text-red-300 hover:bg-red-500/50 animate-pulse">
              ⏹ 停止录制
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {recordings.length === 0 ? (
          <div className="text-cp-text-dim/50 text-xs text-center py-8">暂无录制</div>
        ) : recordings.map(r => (
          <div key={r.id} className="px-3 py-2 border-b border-cp-border/30 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-cp-text">{r.name}</div>
              <div className="text-[10px] text-cp-text-dim mt-0.5">
                {formatDuration(r.duration)} · {r.framesCount} 帧
              </div>
            </div>
            <button onClick={() => playRecording(r.id)} disabled={isPlaying} className="text-xs text-cp-accent hover:underline disabled:opacity-50">
              {isPlaying && currentRecordingId === r.id ? '播放中...' : '▶ 播放'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
