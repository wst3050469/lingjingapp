import { useState, useCallback } from 'react';

export function usePromptPolish() {
  const [isPolishing, setIsPolishing] = useState(false);

  const polish = useCallback(async (text: string): Promise<string> => {
    console.log('[usePromptPolish] polish called with text:', text?.substring(0, 50));
    if (!text.trim() || isPolishing) {
      console.log('[usePromptPolish] Skipping: empty or already polishing');
      return text;
    }
    setIsPolishing(true);

    try {
      // Call AI-powered prompt polish via IPC
      if (window.electronAPI?.prompt?.polish) {
        const result = await window.electronAPI.prompt.polish(text.trim());
        if (result && result.polished && result.polished !== text.trim()) {
          console.log('[usePromptPolish] AI polish succeeded');
          setIsPolishing(false);
          return result.polished;
        }
        console.log('[usePromptPolish] AI polish returned unchanged text, using original');
        setIsPolishing(false);
        return text.trim();
      }

      // Fallback: if electronAPI is not available (e.g., browser dev mode)
      console.warn('[usePromptPolish] electronAPI.prompt.polish not available, using original text');
      setIsPolishing(false);
      return text.trim();
    } catch (error) {
      console.error('[usePromptPolish] AI polish error:', error);
      setIsPolishing(false);
      return text.trim();
    }
  }, [isPolishing]);

  return { isPolishing, polish };
}
