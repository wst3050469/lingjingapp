import { useState, useCallback } from 'react';

export function useFileMentions() {
  const [mentionedFiles, setMentionedFiles] = useState<string[]>([]);

  const addMention = useCallback(async () => {
    console.log('[useFileMentions] addMention called');
    try {
      if (!window.electronAPI?.fs?.selectFile) {
        console.error('[useFileMentions] window.electronAPI.fs.selectFile not available');
        alert('文件选择功能未初始化，请重启应用');
        return;
      }
      const path = await window.electronAPI.fs.selectFile();
      console.log('[useFileMentions] selectFile returned:', path);
      if (path) {
        setMentionedFiles((prev) => prev.includes(path) ? prev : [...prev, path]);
        console.log('[useFileMentions] File added to mentions:', path);
      }
    } catch (err) {
      console.error('[useFileMentions] Error:', err);
    }
  }, []);

  const removeMention = useCallback((path: string) => {
    setMentionedFiles((prev) => prev.filter((p) => p !== path));
  }, []);

  const clearMentions = useCallback(() => {
    setMentionedFiles([]);
  }, []);

  return { mentionedFiles, addMention, removeMention, clearMentions };
}
