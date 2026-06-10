import { create } from 'zustand';

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey';
  status?: 'connected' | 'disconnected' | 'connecting';
}

export interface SSHConnectionForm {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey';
  password?: string;
  privateKey?: string;
}

export interface SSHTerminalInfo {
  sshTerminalId: string;
  connectionId: string;
  name: string;
  host: string;
  username: string;
}

interface RemoteState {
  connections: SSHConnection[];
  activeTerminal: SSHTerminalInfo | null;
  showConnectionDialog: boolean;
  editingConnection: SSHConnection | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadConnections: () => Promise<void>;
  saveConnection: (form: SSHConnectionForm) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (form: SSHConnectionForm) => Promise<{ success: boolean; error?: string }>;
  connect: (connectionId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setShowConnectionDialog: (show: boolean) => void;
  setEditingConnection: (conn: SSHConnection | null) => void;
  clearError: () => void;
}

export const useRemoteStore = create<RemoteState>((set, get) => ({
  connections: [],
  activeTerminal: null,
  showConnectionDialog: false,
  editingConnection: null,
  loading: false,
  error: null,

  loadConnections: async () => {
    try {
      set({ loading: true, error: null });
      const connections = await window.electronAPI.ssh.listConnections();
      set({ connections, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  saveConnection: async (form: SSHConnectionForm) => {
    try {
      set({ loading: true, error: null });
      await window.electronAPI.ssh.saveConnection(form);
      set({ showConnectionDialog: false, editingConnection: null });
      await get().loadConnections();
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  deleteConnection: async (id: string) => {
    try {
      set({ loading: true, error: null });
      await window.electronAPI.ssh.deleteConnection(id);
      // Disconnect if this was the active terminal
      const { activeTerminal } = get();
      if (activeTerminal && activeTerminal.connectionId === id) {
        await window.electronAPI.ssh.disconnect(activeTerminal.sshTerminalId);
        set({ activeTerminal: null });
      }
      await get().loadConnections();
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  testConnection: async (form: SSHConnectionForm): Promise<{ success: boolean; error?: string }> => {
    try {
      return await window.electronAPI.ssh.testConnection(form);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  connect: async (connectionId: string) => {
    try {
      set({ loading: true, error: null });
      const result = await window.electronAPI.ssh.connect(connectionId);
      
      // Update connection status in list
      const connections = get().connections.map(c => 
        c.id === connectionId ? { ...c, status: 'connected' as const } : c
      );
      
      set({
        activeTerminal: {
          sshTerminalId: result.sshTerminalId,
          connectionId,
          name: result.name,
          host: result.host,
          username: result.username,
        },
        connections,
        loading: false,
      });

      // Open SSH terminal tab
      const { useUIStore } = await import('./ui-store.js');
      useUIStore.getState().openBottomPanel('ssh-terminal');

      // Clear previous remote context when switching connections
      const { useRemoteContextStore } = await import('./remote-context-store.js');
      useRemoteContextStore.getState().clearRemoteContext();

      // Show remote folder picker after successful connection
      useUIStore.getState().setShowRemoteFolderPicker(true);
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  disconnect: async () => {
    const { activeTerminal } = get();
    if (activeTerminal) {
      try {
        await window.electronAPI.ssh.disconnect(activeTerminal.sshTerminalId);
        
        const connections = get().connections.map(c => 
          c.id === activeTerminal.connectionId ? { ...c, status: 'disconnected' as const } : c
        );
        
        // Clear remote context when disconnecting
        const { useRemoteContextStore } = await import('./remote-context-store.js');
        useRemoteContextStore.getState().clearRemoteContext();
        
        set({ activeTerminal: null, connections });
      } catch (err: any) {
        set({ error: err.message });
      }
    }
  },

  setShowConnectionDialog: (show: boolean) => set({ showConnectionDialog: show }),
  setEditingConnection: (conn: SSHConnection | null) => set({ editingConnection: conn }),
  clearError: () => set({ error: null }),
}));

// Listen for backend-initiated SSH disconnections (e.g. network drop, server close).
// This ensures the UI stays in sync even when the disconnect wasn't user-initiated.
if (typeof window !== 'undefined' && window.electronAPI?.ssh?.onTerminalClosed) {
  window.electronAPI.ssh.onTerminalClosed(({ sshTerminalId }) => {
    const state = useRemoteStore.getState();
    if (state.activeTerminal?.sshTerminalId === sshTerminalId) {
      // Update connection status in the list
      const connections = state.connections.map(c =>
        c.id === state.activeTerminal?.connectionId ? { ...c, status: 'disconnected' as const } : c
      );
      useRemoteStore.setState({ activeTerminal: null, connections });
    }
  });
}
