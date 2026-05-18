import React from 'react';
import type { ASREngineType, TTSEngineType, VoiceEngineConfig } from '@codepilot/core/voice';
import { useVoiceInteractionStore } from '../../stores/voice-interaction-store';

export const VoiceSettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { autoBroadcast, setAutoBroadcast } = useVoiceInteractionStore();
  const [asrEngine, setAsrEngine] = React.useState<ASREngineType>('web-speech');
  const [ttsEngine, setTtsEngine] = React.useState<TTSEngineType>('web-speech');
  const [ttsRate, setTtsRate] = React.useState(1.0);
  const [ttsVolume, setTtsVolume] = React.useState(80);

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-y-auto">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">语音设置</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">ASR 引擎</label>
          <select value={asrEngine} onChange={e => setAsrEngine(e.target.value as ASREngineType)} className="w-full px-3 py-1.5 text-xs border rounded dark:bg-gray-800 dark:border-gray-600">
            <option value="web-speech">Web Speech API</option>
            <option value="native">系统原生</option>
            <option value="cloud">云端 API</option>
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">TTS 引擎</label>
          <select value={ttsEngine} onChange={e => setTtsEngine(e.target.value as TTSEngineType)} className="w-full px-3 py-1.5 text-xs border rounded dark:bg-gray-800 dark:border-gray-600">
            <option value="web-speech">Web Speech API</option>
            <option value="native">系统原生</option>
            <option value="cloud">云端 API</option>
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">语速: {ttsRate.toFixed(1)}x</label>
          <input type="range" min="0.5" max="2.0" step="0.1" value={ttsRate} onChange={e => setTtsRate(Number(e.target.value))} className="w-full" />
        </div>

        <div className="space-y-3">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">音量: {ttsVolume}%</label>
          <input type="range" min="0" max="100" step="5" value={ttsVolume} onChange={e => setTtsVolume(Number(e.target.value))} className="w-full" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">自动播报结果</span>
          <button onClick={() => setAutoBroadcast(!autoBroadcast)} className={`relative w-10 h-5 rounded-full transition-colors ${autoBroadcast ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoBroadcast ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
