// SSH connection types and interfaces

import type { Client, ClientChannel, SFTPWrapper } from 'ssh2';

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey';
  passwordEncrypted?: string;
  privateKeyEncrypted?: string;
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

export interface SSHSession {
  id: string;
  connectionId: string;
  client: Client;
  shell?: ClientChannel;
  sftp?: SFTPWrapper;
  name: string;
  host: string;
  username: string;
  remoteWorkspacePath?: string;
}

export interface SSHTerminalSession {
  sshTerminalId: string;
  connectionId: string;
  cols: number;
  rows: number;
}

export interface RemoteFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  mtime?: number;
}

export interface RemoteFileStat {
  path: string;
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime: Date;
  permissions: string;
}
