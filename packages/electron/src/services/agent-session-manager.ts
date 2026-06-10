/**
 * AgentSessionManager — Unified session lifecycle manager.
 *
 * Key features:
 *  - Multi-session concurrency (Chat + Quest agents run independently)
 *  - SQLite-backed checkpoint persistence (survive restart / reconnect)
 *  - Per-session Agent instance tracking
 *  - Mobile WebSocket reconnect → restoreSession() → resume inference
 */

import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import {
  Agent,
  Conversation,
  type AgentConfig,
} from '@codepilot/core';
import { getDatabase, saveDatabase } from '../db/database.js';
import { checkpointWriter } from './checkpoint-writer.js';
import { interruptionDetector } from './interruption-detector.js';

const logger = createLogger('agent-session-manager');

const MAX_ACTIVE_SESSIONS = 50;

// ── Types ────────────────────────────────────────────────────────────────

export type SessionType = 'chat' | 'quest';
export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface AgentSession {
  sessionId: string;
  type: SessionType;
  status: SessionStatus;
  taskTitle?: string;
  agent: Agent;
  abortController: AbortController;
  turnCount: number;
  createdAt: number;
  updatedAt: number;
  lastCheckpointAt: number | null;
}

// ── Manager ──────────────────────────────────────────────────────────────

export class AgentSessionManager extends EventEmitter {
  private sessions = new Map<string, AgentSession>();
  private dbReady = false;

  ensureTable(): void {
    if (this.dbReady) return;
    try {
      const db = getDatabase();
      db.run(`
        CREATE TABLE IF NOT EXISTS agent_sessions (
          session_id          TEXT PRIMARY KEY,
          type                TEXT NOT NULL DEFAULT 'chat',
          status              TEXT NOT NULL DEFAULT 'idle',
          task_title          TEXT,
          conversation_json   TEXT DEFAULT '[]',
          config_snapshot_json TEXT DEFAULT '{}',
          checkpoint_step     INTEGER DEFAULT 0,
          checkpoint_timestamp INTEGER DEFAULT 0,
          turn_count          INTEGER DEFAULT 0,
          created_at          TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated ON agent_sessions(updated_at)`);
      this.dbReady = true;
      logger.info('agent_sessions table ready');
    } catch (err) {
      logger.error('Failed to ensure agent_sessions table', err as Error);
    }
  }

  // ── Factory: register an externally-created Agent session ───────────────

  async registerSession(opts: {
    sessionId: string;
    type: SessionType;
    taskTitle?: string;
    agent: Agent;
    abortController: AbortController;
  }): Promise<AgentSession> {
    this.ensureTable();

    const { sessionId, type, taskTitle, agent, abortController } = opts;

    // Abort existing if duplicate
    const existing = this.sessions.get(sessionId);
    if (existing) {
      logger.warn('registerSession: session already exists, aborting', { sessionId });
      try { existing.abortController.abort(); } catch {}
      this.sessions.delete(sessionId);
    }

    const session: AgentSession = {
      sessionId,
      type,
      status: 'running',
      taskTitle,
      agent,
      abortController,
      turnCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastCheckpointAt: null,
    };

    this.sessions.set(sessionId, session);
    logger.info('Session registered', { sessionId, type, taskTitle });
    this.emit('session-created', { sessionId, type });

    return session;
  }

  // ── Accessors ──────────────────────────────────────────────────────────

  getSession(sessionId: string): AgentSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  listSessions(type?: SessionType): AgentSession[] {
    const all = Array.from(this.sessions.values());
    return type ? all.filter((s) => s.type === type) : all;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  updateStatus(sessionId: string, status: SessionStatus): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.status = status;
    s.updatedAt = Date.now();
    this.emit('session-status-changed', { sessionId, status });
  }

  incrementTurn(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.turnCount++;
    s.updatedAt = Date.now();
  }

  createSession(opts: {
    sessionId: string;
    type: SessionType;
    taskTitle?: string;
    conversation?: Conversation;
  }): Promise<AgentSession> {
    // Legacy convenience: creates a minimal registration stub
    // Full agent registration happens via registerSession()
    this.ensureTable();
    const { sessionId, type, taskTitle } = opts;
    const existing = this.sessions.get(sessionId);
    if (existing) return Promise.resolve(existing);

    // Create a placeholder session (agent not yet available — will be updated via registerSession)
    const session: AgentSession = {
      sessionId,
      type,
      status: 'idle',
      taskTitle,
      agent: null as any, // placeholder
      abortController: new AbortController(),
      turnCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastCheckpointAt: null,
    };

    this.sessions.set(sessionId, session);
    logger.info('Session placeholder created', { sessionId, type });
    return Promise.resolve(session);
  }

  abortSession(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    try { s.abortController.abort(); } catch {}
    this.updateStatus(sessionId, 'cancelled');
  }

  destroySession(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    this.checkpointSession(sessionId).catch(() => {});
    try { s.abortController.abort(); } catch {}
    this.sessions.delete(sessionId);
    logger.info('Session destroyed', { sessionId });
    this.emit('session-destroyed', { sessionId });
  }

  abortAll(type?: SessionType): void {
    for (const [id, s] of this.sessions) {
      if (!type || s.type === type) {
        try { s.abortController.abort(); } catch {}
        this.updateStatus(id, 'cancelled');
      }
    }
    if (!type) this.sessions.clear();
  }

  pauseSession(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s || s.status !== 'running') return;

    const oldAbort = s.abortController;
    s.abortController = new AbortController();
    try { oldAbort.abort(); } catch {}

    this.updateStatus(sessionId, 'paused');
    this.checkpointSession(sessionId);
  }

  // ── SQLite Checkpoint ──────────────────────────────────────────────────

  async checkpointSession(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) return;

    try {
      this.ensureTable();

      let conversationJson = '[]';
      try {
        const msgs = s.agent?.conversation?.messages;
        if (msgs && msgs.length > 0) {
          conversationJson = JSON.stringify(msgs.map((m: any) => ({
            role: m.role,
            content: m.content,
            ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
          })));
        }
      } catch {}

      const serialized = checkpointWriter.serialize({
        conversationMessages: JSON.parse(conversationJson),
        configSnapshot: {},
        toolRegistrySnapshot: {},
      });
      const encrypted = checkpointWriter.encrypt(serialized);

      await checkpointWriter.writeAsync(sessionId, encrypted, s.turnCount, s.turnCount);

      const db = getDatabase();
      db.run(
        `UPDATE agent_sessions SET type = ?, status = ?, task_title = ?, turn_count = ?, last_activity_at = ?, updated_at = datetime('now')
         WHERE session_id = ?`,
        [s.type, s.status, s.taskTitle ?? null, s.turnCount, Date.now(), sessionId],
      );
      await saveDatabase();

      s.lastCheckpointAt = Date.now();
      logger.debug('Checkpoint saved (encrypted)', { sessionId, turnCount: s.turnCount });
    } catch (err) {
      logger.error('Failed to checkpoint session', err as Error, { sessionId });
    }
  }

  async restoreSession(sessionId: string): Promise<{
    sessionId: string;
    type: SessionType;
    status: SessionStatus;
    taskTitle?: string;
    turnCount: number;
    messages: Array<{ role: string; content: string; toolCalls?: any }>;
  } | null> {
    try {
      this.ensureTable();
      const db = getDatabase();
      const rows = db.exec(
        `SELECT * FROM agent_sessions WHERE session_id = ?`,
        [sessionId],
      );

      if (!rows[0]?.values?.length) {
        logger.debug('No checkpoint found for session', { sessionId });
        return null;
      }

      const row = rows[0].values[0];
      const rawConversationJson = String(row[4] || '[]');

      let messages: Array<{ role: string; content: string; toolCalls?: any }> = [];

      try {
        const decrypted = checkpointWriter.decrypt(rawConversationJson);
        const parsed = JSON.parse(decrypted);
        const rawMessages = parsed.conversationMessages || parsed;
        messages = rawMessages.map((m: any) => ({
          role: m.role,
          content: m.content,
          ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
        }));
      } catch {
        try {
          const rawMessages = JSON.parse(rawConversationJson);
          messages = rawMessages.map((m: any) => ({
            role: m.role,
            content: m.content,
            ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
          }));
        } catch (parseErr) {
          logger.warn('Checkpoint data corrupted, returning empty messages', { sessionId });
          messages = [];
        }
      }

      logger.info('Session checkpoint loaded', {
        sessionId,
        turnCount: Number(row[8]) || 0,
        messageCount: messages.length,
      });

      return {
        sessionId: String(row[0]),
        type: (row[1] || 'chat') as SessionType,
        status: (row[2] || 'idle') as SessionStatus,
        taskTitle: (row[3] as string) || undefined,
        turnCount: Number(row[8]) || 0,
        messages,
      };
    } catch (err) {
      logger.error('Failed to restore session', err as Error, { sessionId });
      return null;
    }
  }

  deleteCheckpoint(sessionId: string): void {
    try {
      this.ensureTable();
      const db = getDatabase();
      db.run(`DELETE FROM agent_sessions WHERE session_id = ?`, [sessionId]);
      logger.debug('Checkpoint deleted', { sessionId });
    } catch (err) {
      logger.error('Failed to delete checkpoint', err as Error, { sessionId });
    }
  }

  cleanupOldSessions(olderThanDays = 30): number {
    try {
      this.ensureTable();
      const db = getDatabase();

      db.run(
        `DELETE FROM agent_sessions
         WHERE updated_at < datetime('now', '-' || ? || ' days')`,
        [olderThanDays],
      );

      const activeCount = db.exec(`SELECT COUNT(*) FROM agent_sessions WHERE status IN ('running', 'idle')`)[0]?.values?.[0]?.[0] as number || 0;
      if (activeCount > MAX_ACTIVE_SESSIONS) {
        const excess = activeCount - MAX_ACTIVE_SESSIONS;
        db.run(
          `DELETE FROM agent_sessions
           WHERE status IN ('running', 'idle')
           AND session_id NOT IN (
             SELECT session_id FROM agent_sessions
             WHERE status IN ('running', 'idle')
             ORDER BY last_activity_at DESC
             LIMIT ?
           )`,
          [MAX_ACTIVE_SESSIONS],
        );
        logger.info('LRU cleanup applied', { removedByLRU: excess });
      }

      const result = db.exec('SELECT changes()');
      const deleted = result[0]?.values?.[0]?.[0] as number || 0;
      logger.info('Cleaned up old sessions', { olderThanDays, deleted });
      return deleted;
    } catch (err) {
      logger.error('Failed to cleanup old sessions', err as Error);
      return 0;
    }
  }

  detectInterruption(sessionId: string): boolean {
    return interruptionDetector.isInterrupted(sessionId);
  }

  async autoRecover(sessionId: string): Promise<boolean> {
    if (!interruptionDetector.isInterrupted(sessionId)) return false;
    const restored = await this.restoreSession(sessionId);
    if (restored) {
      interruptionDetector.clearInterrupted(sessionId);
      logger.info('Session auto-recovered', { sessionId });
      return true;
    }
    return false;
  }

  // DEF-010: 从checkpoint恢复中断会话
  async resumeFromCheckpoint(sessionId: string): Promise<{ sessionId: string; messages: any[] } | null> {
    try {
      const restored = await this.restoreSession(sessionId);
      if (!restored) {
        logger.error('Cannot restore session from checkpoint', { sessionId });
        return null;
      }
      // @ts-ignore - encrypted may be added by checkpoint writer
      const valid = checkpointWriter.verifyIntegrity(restored.encrypted ?? '');
      if (!valid) {
        logger.error('Checkpoint integrity check failed', { sessionId });
        return null;
      }
      this.updateStatus(sessionId, 'running');
      return { sessionId, messages: restored.messages ?? [] };
    } catch (err) {
      logger.error('resumeFromCheckpoint failed', err as Error);
      return null;
    }
  }

  async restoreAllActiveSessions(): Promise<string[]> {
    try {
      this.ensureTable();
      const db = getDatabase();
      const rows = db.exec(
        `SELECT session_id FROM agent_sessions WHERE status IN ('running', 'idle') ORDER BY last_activity_at DESC`,
      );
      const sessionIds: string[] = [];
      for (const row of rows[0]?.values ?? []) {
        sessionIds.push(String(row[0]));
      }
      logger.info('Found active sessions to restore', { count: sessionIds.length });
      return sessionIds;
    } catch (err) {
      logger.error('Failed to find active sessions', err as Error);
      return [];
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

export const agentSessionManager = new AgentSessionManager();
