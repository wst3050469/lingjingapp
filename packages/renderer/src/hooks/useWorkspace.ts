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
    // Listen to workspace restored event
    const handleRestored = (_event: any, info: WorkspaceInfo) => {
      console.log('[Renderer] Workspace restored:', info);
      setWorkspace(info.path);
      setIsLoading(false);
      setError(null);
    };

    // Listen to workspace changed event
    const handleChanged = (_event: any, info: { oldPath: string; newPath: string; timestamp: number }) => {
      console.log('[Renderer] Workspace changed:', info);
      setWorkspace(info.newPath);
      setError(null);
    };

    // Listen to permission denied event
    const handlePermissionDenied = (_event: any, info: { path: string; message: string }) => {
      console.warn('[Renderer] Workspace permission denied:', info);
      setError(info.message);
    };

    // Listen to error event
    const handleError = (_event: any, info: WorkspaceError) => {
      console.error('[Renderer] Workspace error:', info);
      setError(info.error);
      setIsLoading(false);
    };

    // Register IPC event listeners
    window.electron.ipcRenderer.on('workspace:restored', handleRestored);
    window.electron.ipcRenderer.on('workspace:changed', handleChanged);
    window.electron.ipcRenderer.on('workspace:permission-denied', handlePermissionDenied);
    window.electron.ipcRenderer.on('workspace:error', handleError);

    // Cleanup function
    return () => {
      window.electron.ipcRenderer.removeListener('workspace:restored', handleRestored);
      window.electron.ipcRenderer.removeListener('workspace:changed', handleChanged);
      window.electron.ipcRenderer.removeListener('workspace:permission-denied', handlePermissionDenied);
      window.electron.ipcRenderer.removeListener('workspace:error', handleError);
    };
  }, []);

  return { workspace, isLoading, error };
}
