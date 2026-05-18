import React, { useEffect, useCallback } from 'react';
import { useCompletionStore } from '../stores/completion-store';

export const InlineCompletionWidget: React.FC = () => {
  const { ghostText, sessionState, setSessionState, reset } = useCompletionStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (sessionState !== 'completed' && sessionState !== 'streaming') return;

    if (e.key === 'Tab') {
      e.preventDefault();
      window.electronAPI?.completion?.accept();
      reset();
    } else if (e.key === 'ArrowRight' && e.ctrlKey) {
      e.preventDefault();
      window.electronAPI?.completion?.acceptWord();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      window.electronAPI?.completion?.reject();
      reset();
    }
  }, [sessionState, reset]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!ghostText || sessionState === 'idle') return null;

  return (
    <span
      className="ghost-text text-gray-400 dark:text-gray-500 italic pointer-events-none select-none whitespace-pre"
      style={{ textDecoration: 'none' }}
    >
      {ghostText}
    </span>
  );
};
