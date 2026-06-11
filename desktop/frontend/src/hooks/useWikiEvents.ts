// Wiki event subscription hook - listens to wiki:event from main process

import { useEffect } from 'react';
import { useWikiStore } from '../stores/wiki-store';
import type { WikiEventData } from '../ipc/ipc-client';

export function useWikiEvents(): void {
  useEffect(() => {
    const cleanup = window.electronAPI.wiki.onEvent((event: WikiEventData) => {
      const store = useWikiStore.getState();

      if (event.type === 'progress') {
        if (event.phase === 'done') {
          store.onDone();
        } else {
          store.onProgress({
            phase: event.phase || 'scanning',
            current: event.current || 0,
            total: event.total || 0,
            modulePath: event.modulePath,
          });
        }
      } else if (event.type === 'error') {
        store.onError(event.message || 'Unknown error');
      }
    });

    return cleanup;
  }, []);
}
