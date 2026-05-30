// Auth IPC handler - bridges auth service with Electron renderer

import { ipcMain } from 'electron';
import {
  registerUser,
  loginUser,
  verifyToken,
  saveConversation,
  loadConversations,
  loadConversationMessages,
  deleteConversation,
  renameConversation,
} from '../auth/auth-service.js';
import { pushSessionToCloud } from './cloud-ipc.js';
import { getDatabase, saveDatabaseSync } from '../db/database.js';

export function registerAuthIpc(): void {
  ipcMain.handle('auth:register', async (_event, { username, password, email }: {
    username: string;
    password: string;
    email?: string;
  }) => {
    try {
      return await registerUser(username, password, email);
    } catch (err) {
      console.error('auth:register error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });

  ipcMain.handle('auth:login', async (_event, { username, password }: {
    username: string;
    password: string;
  }) => {
    try {
      return await loginUser(username, password);
    } catch (err) {
      console.error('auth:login error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });

  ipcMain.handle('auth:verify', async (_event, { token }: { token: string }) => {
    try {
      const user = await verifyToken(token);
      return user ? { valid: true, user } : { valid: false };
    } catch (err) {
      console.error('auth:verify error:', err);
      return { valid: false };
    }
  });

  // Conversation persistence
  ipcMain.handle('conversation:save', async (_event, { userId, conversationId, title, messages }: {
    userId: number;
    conversationId: string;
    title: string;
    messages: Array<{ role: string; content: string; toolCalls?: unknown }>;
  }) => {
    await saveConversation(userId, conversationId, title, messages);

    // Auto-push to cloud
    pushSessionToCloud({
      id: conversationId,
      title,
      messages,
    });

    return { success: true };
  });

  ipcMain.handle('conversation:list', async (_event, { userId }: { userId: number }) => {
    return loadConversations(userId);
  });

  ipcMain.handle('conversation:load', async (_event, { conversationId }: { conversationId: string }) => {
    return loadConversationMessages(conversationId);
  });

  ipcMain.handle('conversation:delete', async (_event, { conversationId }: { conversationId: string }) => {
    await deleteConversation(conversationId);
    return { success: true };
  });

  ipcMain.handle('conversation:rename', async (_event, { conversationId, newTitle }: { conversationId: string; newTitle: string }) => {
    await renameConversation(conversationId, newTitle);
    return { success: true };
  });

  ipcMain.on('conversation:save-sync', (event, { userId, conversationId, title, messages }: {
    userId: number;
    conversationId: string;
    title: string;
    messages: Array<{ role: string; content: string; toolCalls?: unknown }>;
  }) => {
    try {
      const db = getDatabase();

      db.run(
        `INSERT OR REPLACE INTO conversations (id, user_id, title, updated_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [conversationId, userId, title],
      );

      db.run(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId]);

      for (const msg of messages) {
        db.run(
          `INSERT INTO messages (conversation_id, role, content, tool_calls) VALUES (?, ?, ?, ?)`,
          [conversationId, msg.role, msg.content, msg.toolCalls ? JSON.stringify(msg.toolCalls) : null],
        );
      }

      saveDatabaseSync();

      event.returnValue = { success: true };
    } catch (err) {
      console.error('[Auth] conversation:save-sync error:', err);
      event.returnValue = { success: false, error: String(err) };
    }
  });
}
