// Memory IPC handler - manages long-term memory storage

import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/database.js';
import { pushMemoryToCloud } from './cloud-ipc.js';

export interface Memory {
  id: string;
  scope: 'global' | 'project';
  project_path: string | null;
  category: string;
  title: string;
  content: string;
  source: 'active' | 'automatic';
  created_at: string;
  updated_at: string;
}

export function registerMemoryIpc(): void {
  // List memories with optional scope/project filter
  ipcMain.handle('memory:list', async (_event, opts?: {
    scope?: 'global' | 'project';
    projectPath?: string;
  }) => {
    try {
      const db = getDatabase();
      let sql = 'SELECT * FROM memories';
      const conditions: string[] = [];
      const params: string[] = [];

      if (opts?.scope) {
        conditions.push('scope = ?');
        params.push(opts.scope);
      }
      if (opts?.projectPath) {
        conditions.push('project_path = ?');
        params.push(opts.projectPath);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY updated_at DESC';

      const stmt = db.prepare(sql);
      if (params.length > 0) stmt.bind(params);

      const results: Memory[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as Memory);
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('memory:list error:', err);
      return [];
    }
  });

  // Search memories by keyword
  ipcMain.handle('memory:search', async (_event, { query, scope, projectPath }: {
    query: string;
    scope?: 'global' | 'project';
    projectPath?: string;
  }) => {
    try {
      const db = getDatabase();
      const conditions = ['(title LIKE ? OR content LIKE ?)'];
      const params: string[] = [`%${query}%`, `%${query}%`];

      if (scope) {
        conditions.push('scope = ?');
        params.push(scope);
      }
      if (projectPath) {
        conditions.push('project_path = ?');
        params.push(projectPath);
      }

      const sql = `SELECT * FROM memories WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`;
      const stmt = db.prepare(sql);
      stmt.bind(params);

      const results: Memory[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as Memory);
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('memory:search error:', err);
      return [];
    }
  });

  // Add a new memory
  ipcMain.handle('memory:add', async (_event, mem: {
    scope: 'global' | 'project';
    projectPath?: string;
    category: string;
    title: string;
    content: string;
    source: 'active' | 'automatic';
  }) => {
    try {
      const db = getDatabase();
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      db.run(
        `INSERT INTO memories (id, scope, project_path, category, title, content, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, mem.scope, mem.projectPath || null, mem.category, mem.title, mem.content, mem.source],
      );
      await saveDatabase();

      // Auto-push to cloud
      pushMemoryToCloud({
        title: mem.title,
        content: mem.content,
        category: mem.category,
        scope: mem.scope,
      });

      return { success: true, id };
    } catch (err) {
      console.error('memory:add error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });

  // Delete a memory by id
  ipcMain.handle('memory:delete', async (_event, { id }: { id: string }) => {
    try {
      const db = getDatabase();
      db.run('DELETE FROM memories WHERE id = ?', [id]);
      await saveDatabase();
      return { success: true };
    } catch (err) {
      console.error('memory:delete error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });

  // Delete all memories (with optional scope/project filter)
  ipcMain.handle('memory:clear', async (_event, opts?: {
    scope?: 'global' | 'project';
    projectPath?: string;
  }) => {
    try {
      const db = getDatabase();
      if (opts?.scope && opts?.projectPath) {
        db.run('DELETE FROM memories WHERE scope = ? AND project_path = ?', [opts.scope, opts.projectPath]);
      } else if (opts?.scope) {
        db.run('DELETE FROM memories WHERE scope = ?', [opts.scope]);
      } else {
        db.run('DELETE FROM memories');
      }
      await saveDatabase();
      return { success: true };
    } catch (err) {
      console.error('memory:clear error:', err);
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  });
}
