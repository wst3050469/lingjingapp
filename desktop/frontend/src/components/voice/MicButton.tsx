import React from 'react';
import { useVoiceInteractionStore } from '../../stores/voice-interaction-store';

export const MicButton: React.FC = () => {
  const { voiceStatus, startRecording, stopRecording, interimTranscript } = useVoiceInteractionStore();
  const isRecording = voiceStatus === 'recording';
  const isProcessing = ['recognizing', 'processing', 'broadcasting', 'confirming'].includes(voiceStatus);
  const isIdle = voiceStatus === 'idle';

  const handleClick = () => {
    if (isIdle) startRecording();
    else if (isRecording) stopRecording();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        disabled={isProcessing}
        className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
          isRecording
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110'
            : isProcessing
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/30'
        }`}
      >
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping opacity-30" />
            <span className="absolute inset-2 rounded-full border-2 border-red-200 animate-ping opacity-20" style={{ animationDelay: '0.3s' }} />
          </>
        )}
      </button>
      {isRecording && interimTranscript && (
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-48 truncate">{interimTranscript}</p>
      )}
      <p className="text-xs text-gray-500">
        {isIdle ? '点击开始说话' : isRecording ? '说话中...' : isProcessing ? '处理中...' : ''}
      </p>
    </div>
  );
};
