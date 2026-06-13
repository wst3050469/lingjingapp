import { useEffect, useState } from 'react';

interface WorkspaceInfo {
  path: string;
  timestamp: number;
  source?: string;
}

interface WorkspaceError {
  error: string;
  path?: string;
  timestamp: number;
}

/**
 * Hook to manage workspace state and listen to workspace IPC events
 */
export function useWorkspace() {
  const [workspace, setWorkspace] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    // Listen to workspace restored event
    unsubscribers.push(window.electronAPI.on('workspace:restored', (info: WorkspaceInfo) => {
      console.log('[Renderer] Workspace restored:', info);
      setWorkspace(info.path);
      setIsLoading(false);
      setError(null);
    }));

    // Listen to workspace changed event
    unsubscribers.push(window.electronAPI.on('workspace:changed', (info: { oldPath: string; newPath: string; timestamp: number }) => {
      console.log('[Renderer] Workspace changed:', info);
      setWorkspace(info.newPath);
      setError(null);
    }));

    // Listen to permission denied event
    unsubscribers.push(window.electronAPI.on('workspace:permission-denied', (info: { path: string; message: string }) => {
      console.warn('[Renderer] Workspace permission denied:', info);
      setError(info.message);
    }));

    // Listen to error event
    unsubscribers.push(window.electronAPI.on('workspace:error', (info: WorkspaceError) => {
      console.error('[Renderer] Workspace error:', info);
      setError(info.error);
      setIsLoading(false);
    }));

    // Cleanup function
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  return { workspace, isLoading, error };
}
