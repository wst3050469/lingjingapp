import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { agentSessionManager } from './agent-session-manager.js';

const logger = createLogger('session-sync-service');

export class SessionSyncService extends EventEmitter {
  async syncSessionList(deviceId: string): Promise<any[]> {
    try {
      const sessions = agentSessionManager.listSessions();
      return sessions.map((s) => ({
        sessionId: s.sessionId,
        type: s.type,
        status: s.status,
        taskTitle: s.taskTitle,
        turnCount: s.turnCount,
        updatedAt: s.updatedAt,
      }));
    } catch (err) {
      logger.error('Failed to sync session list', err as Error);
      return [];
    }
  }

  async syncSessionState(sessionId: string): Promise<any | null> {
    try {
      const session = agentSessionManager.getSession(sessionId);
      if (!session) return null;
      return {
        sessionId: session.sessionId,
        type: session.type,
        status: session.status,
        taskTitle: session.taskTitle,
        turnCount: session.turnCount,
        updatedAt: session.updatedAt,
      };
    } catch (err) {
      logger.error('Failed to sync session state', err as Error, { sessionId });
      return null;
    }
  }

  async handleReconnect(sessionId: string): Promise<any | null> {
    try {
      const restored = await agentSessionManager.restoreSession(sessionId);
      if (restored) {
        logger.info('Session restored on reconnect', { sessionId });
        this.emit('session-restored', { sessionId });
      }
      return restored;
    } catch (err) {
      logger.error('Failed to handle reconnect', err as Error, { sessionId });
      return null;
    }
  }
}

export const sessionSyncService = new SessionSyncService();