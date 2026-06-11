import React from 'react';
import { useVoiceInteractionStore } from '../../stores/voice-interaction-store';

export const BroadcastStopButton: React.FC = () => {
  const { voiceStatus, interruptSession } = useVoiceInteractionStore();

  if (voiceStatus !== 'broadcasting') return null;

  return (
    <button
      onClick={async () => {
        await window.electronAPI?.voice?.['tts:stop']?.();
        interruptSession();
      }}
      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
      title="停止播报"
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    </button>
  );
};
