import { useEffect } from 'react';
import { useVoiceInteractionStore } from '../stores/voice-interaction-store';

export function useVoiceSession(): void {
  const { handleASRResult, interruptSession } = useVoiceInteractionStore();

  useEffect(() => {
    const cleanupASR = window.electronAPI?.voice?.['asr:onResult']?.((result: unknown) => {
      handleASRResult(result as any);
    });

    const handleToggleMode = () => {
      useVoiceInteractionStore.getState().toggleMode();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const { voiceStatus } = useVoiceInteractionStore.getState();
        if (voiceStatus !== 'idle') {
          interruptSession();
        }
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        useVoiceInteractionStore.getState().toggleMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cleanupASR?.();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleASRResult, interruptSession]);
}
