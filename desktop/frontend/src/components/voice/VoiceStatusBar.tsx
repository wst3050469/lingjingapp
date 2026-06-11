import React from 'react';
import { useVoiceInteractionStore } from '../../stores/voice-interaction-store';
import type { VoiceSessionState } from '@codepilot/core/voice';

const statusConfig: Record<VoiceSessionState, { label: string; color: string; icon: string }> = {
  idle: { label: '就绪', color: 'text-gray-500', icon: '🎙️' },
  recording: { label: '录音中', color: 'text-red-500', icon: '🔴' },
  recognizing: { label: '识别中', color: 'text-yellow-500', icon: '⏳' },
  processing: { label: '处理中', color: 'text-blue-500', icon: '⚙️' },
  broadcasting: { label: '播报中', color: 'text-green-500', icon: '🔊' },
  confirming: { label: '等待确认', color: 'text-orange-500', icon: '❓' },
};

export const VoiceStatusBar: React.FC = () => {
  const { voiceStatus, interimTranscript, finalTranscript, currentMode, interruptSession } = useVoiceInteractionStore();

  if (currentMode !== 'voice') return null;

  const config = statusConfig[voiceStatus];
  const isActive = voiceStatus !== 'idle';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs">
      <span>{config.icon}</span>
      <span className={`font-medium ${config.color}`}>{config.label}</span>
      {(interimTranscript || finalTranscript) && (
        <span className="flex-1 truncate text-gray-600 dark:text-gray-400">
          {finalTranscript || interimTranscript}
        </span>
      )}
      {isActive && (
        <button
          onClick={interruptSession}
          className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 rounded hover:bg-gray-300"
        >
          中断
        </button>
      )}
    </div>
  );
};
