import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { agentSessionManager } from './agent-session-manager.js';

const logger = createLogger('multi-agent-manager');

export class MultiAgentManager extends EventEmitter {
  listAgents(): any[] {
    const sessions = agentSessionManager.listSessions();
    return sessions.map((s) => ({
      sessionId: s.sessionId,
      type: s.type,
      status: s.status,
      taskTitle: s.taskTitle,
      turnCount: s.turnCount,
    }));
  }

  getAgentStatus(sessionId: string): any | null {
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
  }

  switchAgent(sessionId: string): boolean {
    const session = agentSessionManager.getSession(sessionId);
    if (!session) return false;
    this.emit('agent-switched', { sessionId });
    return true;
  }
}

export const multiAgentManager = new MultiAgentManager();