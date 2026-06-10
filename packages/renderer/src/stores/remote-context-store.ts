import { create } from 'zustand';

export interface RemoteContextState {
  isRemoteMode: boolean;
  sshTerminalId: string | null;
  connectionId: string | null;
  remoteWorkspacePath: string | null;
  connectionName: string | null;
  host: string | null;
  username: string | null;

  setRemoteContext: (ctx: {
    sshTerminalId: string;
    connectionId: string;
    remoteWorkspacePath: string;
    connectionName: string;
    host: string;
    username: string;
  }) => void;
  clearRemoteContext: () => void;
  setRemoteWorkspace: (path: string) => void;
}

export const useRemoteContextStore = create<RemoteContextState>((set) => ({
  isRemoteMode: false,
  sshTerminalId: null,
  connectionId: null,
  remoteWorkspacePath: null,
  connectionName: null,
  host: null,
  username: null,

  setRemoteContext: (ctx) => set({
    isRemoteMode: true,
    sshTerminalId: ctx.sshTerminalId,
    connectionId: ctx.connectionId,
    remoteWorkspacePath: ctx.remoteWorkspacePath,
    connectionName: ctx.connectionName,
    host: ctx.host,
    username: ctx.username,
  }),

  clearRemoteContext: () => set({
    isRemoteMode: false,
    sshTerminalId: null,
    connectionId: null,
    remoteWorkspacePath: null,
    connectionName: null,
    host: null,
    username: null,
  }),

  setRemoteWorkspace: (path) => set({ remoteWorkspacePath: path }),
}));
