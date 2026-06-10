import { ipcMain } from 'electron';
import { agentSessionManager } from '../services/agent-session-manager.js';
import { checkpointWriter } from '../services/checkpoint-writer.js';
import { interruptionDetector } from '../services/interruption-detector.js';

export function registerSessionCheckpointIpc(): void {
  ipcMain.handle('session:checkpoint', async (_event, { sessionId }: { sessionId: string }) => {
    try {
      await agentSessionManager.checkpointSession(sessionId);
      return { success: true };
    } catch (err) {
      console.error('session:checkpoint error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:restore', async (_event, { sessionId }: { sessionId: string }) => {
    try {
      const result = await agentSessionManager.restoreSession(sessionId);
      return { success: true, data: result };
    } catch (err) {
      console.error('session:restore error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:list-active', async () => {
    try {
      const sessionIds = await agentSessionManager.restoreAllActiveSessions();
      return { success: true, sessionIds };
    } catch (err) {
      console.error('session:list-active error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:list', async () => {
    try {
      const sessions = agentSessionManager.listSessions();
      const result = sessions.map((s) => ({
        sessionId: s.sessionId,
        type: s.type,
        status: s.status,
        taskTitle: s.taskTitle,
        turnCount: s.turnCount,
        messageCount: s.agent?.conversation?.messages?.length ?? 0,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        lastCheckpointAt: s.lastCheckpointAt,
      }));
      return { success: true, sessions: result };
    } catch (err) {
      console.error('session:list error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:detect-interruption', async (_event, { sessionId }: { sessionId: string }) => {
    try {
      const interrupted = agentSessionManager.detectInterruption(sessionId);
      if (interrupted) {
        const recovered = await agentSessionManager.autoRecover(sessionId);
        return { interrupted: true, recovered };
      }
      return { interrupted: false, recovered: false };
    } catch (err) {
      console.error('session:detect-interruption error:', err);
      return { interrupted: false, error: String(err) };
    }
  });
}