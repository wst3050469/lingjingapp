import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/database.js';

export function registerSkillReviewIpc(): void {
  // ── Add/Update a review ──
  ipcMain.handle('skill:review:upsert', async (_event, {
    skillId, rating, title, review
  }: {
    skillId: string; rating: number; title?: string; review?: string;
  }) => {
    try {
      const db = getDatabase();
      const id = `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      
      // Upsert: delete old review from same user, then insert new
      db.run('DELETE FROM skill_reviews WHERE skill_id = ? AND user_id = ?', [skillId, 'local']);
      db.run(
        `INSERT INTO skill_reviews (id, skill_id, user_id, rating, title, review) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, skillId, 'local', rating, title || '', review || '']
      );
      
      // Update skill_meta aggregate rating
      const stats = db.exec(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM skill_reviews WHERE skill_id = ?`,
        [skillId]
      );
      if (stats.length > 0 && stats[0].values.length > 0) {
        const [avgRating, reviewCount] = stats[0].values[0] as [number, number];
        db.run(
          `UPDATE skill_meta SET rating = ?, review_count = ? WHERE id = ?`,
          [Math.round(avgRating * 10) / 10, reviewCount, skillId]
        );
      }
      
      // Log usage
      db.run(
        `INSERT INTO skill_usage_stats (id, skill_id, metric) VALUES (?, ?, 'view')`,
        [`stat-${Date.now().toString(36)}`, skillId]
      );
      
      await saveDatabase();
      return { success: true, id };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ── Get reviews for a skill ──
  ipcMain.handle('skill:review:list', async (_event, { skillId }: { skillId: string }) => {
    try {
      const db = getDatabase();
      const result = db.exec(
        `SELECT id, skill_id, rating, title, review, created_at FROM skill_reviews WHERE skill_id = ? ORDER BY created_at DESC`,
        [skillId]
      );
      const reviews = result.length > 0
        ? result[0].values.map((row: any[]) => ({
            id: row[0], skillId: row[1], rating: row[2],
            title: row[3], review: row[4], createdAt: row[5]
          }))
        : [];
      return { success: true, reviews };
    } catch (err) {
      return { success: false, error: String(err), reviews: [] };
    }
  });

  // ── Get skill stats (rating, installs, usage) ──
  ipcMain.handle('skill:stats', async (_event, { skillId }: { skillId: string }) => {
    try {
      const db = getDatabase();
      const ratingResult = db.exec(
        `SELECT AVG(rating), COUNT(*) FROM skill_reviews WHERE skill_id = ?`,
        [skillId]
      );
      const execResult = db.exec(
        `SELECT COUNT(*) FROM skill_usage_stats WHERE skill_id = ? AND metric = 'execute'`,
        [skillId]
      );
      const avgRating = ratingResult[0]?.values?.[0]?.[0] || 0;
      const reviewCount = ratingResult[0]?.values?.[0]?.[1] || 0;
      const execCount = execResult[0]?.values?.[0]?.[0] || 0;
      return { success: true, stats: { avgRating, reviewCount, execCount } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ── Track skill usage ──
  ipcMain.handle('skill:track-usage', async (_event, { skillId, metric }: { skillId: string; metric: string }) => {
    try {
      const db = getDatabase();
      db.run(
        `INSERT INTO skill_usage_stats (id, skill_id, metric) VALUES (?, ?, ?)`,
        [`stat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`, skillId, metric]
      );
      await saveDatabase();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  console.log('[IPC] Skill Review handlers registered');
}
