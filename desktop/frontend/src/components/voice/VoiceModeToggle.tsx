import React from 'react';
import { useVoiceInteractionStore } from '../../stores/voice-interaction-store';

export const VoiceModeToggle: React.FC = () => {
  const { currentMode, toggleMode } = useVoiceInteractionStore();
  const isVoice = currentMode === 'voice';

  return (
    <button
      onClick={toggleMode}
      className={`relative p-2 rounded-lg transition-all ${
        isVoice ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
      }`}
      title={isVoice ? '切换到文本模式' : '切换到语音模式'}
    >
      {isVoice ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      )}
      {isVoice && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      )}
    </button>
  );
};
