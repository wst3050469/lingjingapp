// SSH Session Manager - provides access to SSH sessions from other modules

import type { SFTPWrapper } from 'ssh2';

// Global SSH sessions map (imported from ssh-ipc)
let sshSessions: Map<string, { sftp?: SFTPWrapper; remoteWorkspacePath?: string }> | null = null;

/**
 * Register the SSH sessions map reference.
 * Called during initialization to allow access to sessions.
 */
export function registerSshSessions(sessions: Map<string, { sftp?: SFTPWrapper; remoteWorkspacePath?: string }>): void {
  sshSessions = sessions;
}

/**
 * Get the SFTP wrapper for a given SSH terminal ID.
 * Returns null if no session exists or SFTP is not available.
 */
export function getSftpSession(sshTerminalId: string): SFTPWrapper | null {
  if (!sshSessions) {
    console.error('[SSH Session Manager] SSH sessions not registered');
    return null;
  }
  
  const session = sshSessions.get(sshTerminalId);
  if (!session) {
    console.error(`[SSH Session Manager] No session found for terminal ID: ${sshTerminalId}`);
    return null;
  }
  
  if (!session.sftp) {
    console.error(`[SSH Session Manager] SFTP not available for terminal ID: ${sshTerminalId}`);
    return null;
  }
  
  return session.sftp;
}

/**
 * Get the remote workspace path for an SSH session.
 * Returns the path set by the user, or null if not set.
 */
export function getRemoteWorkspacePath(sshTerminalId: string): string | null {
  if (!sshSessions) {
    return null;
  }

  const session = sshSessions.get(sshTerminalId);
  if (!session) {
    return null;
  }

  return session.remoteWorkspacePath || null;
}
