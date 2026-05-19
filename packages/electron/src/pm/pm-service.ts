import { WorkItemStateMachine } from '@codepilot/core/pm';
import type { WorkItem, WorkItemStatus, BoardColumn, Milestone, CreateWorkItemInput, UpdateWorkItemInput } from '@codepilot/core/pm';
import { getDatabase, saveDatabase } from '../db/database.js';

export class PMService {
  private stateMachine: WorkItemStateMachine;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.stateMachine = new WorkItemStateMachine();
  }

  async listWorkItems(filter?: { type?: string; status?: string; assignee?: string; milestoneId?: string }): Promise<any[]> {
    const db = getDatabase();
    let query = `SELECT * FROM work_items WHERE project_path = ?`;
    const params: any[] = [this.projectPath];
    if (filter?.type) { query += ` AND type = ?`; params.push(filter.type); }
    if (filter?.status) { query += ` AND status = ?`; params.push(filter.status); }
    if (filter?.assignee) { query += ` AND assignee = ?`; params.push(filter.assignee); }
    if (filter?.milestoneId) { query += ` AND milestone_id = ?`; params.push(filter.milestoneId); }
    query += ` ORDER BY updated_at DESC`;
    const result = db.exec(query, params);
    if (!result.length || !result[0].values.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }

  async createWorkItem(input: CreateWorkItemInput): Promise<string> {
    const db = getDatabase();
    const id = `wi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.run(`INSERT INTO work_items (id, title, description, type, status, priority, assignee, project_path, milestone_id, labels, defect_severity, defect_category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.title, input.description || '', input.type || 'task', 'todo', input.priority || 'medium', input.assignee || '', this.projectPath, input.milestoneId || '', JSON.stringify(input.labels || []), input.defectSeverity || '', input.defectCategory || '']);
    await saveDatabase();
    return id;
  }

  async updateWorkItem(id: string, input: UpdateWorkItemInput): Promise<boolean> {
    const db = getDatabase();
    const existing = db.exec(`SELECT version FROM work_items WHERE id = ?`, [id]);
    if (!existing.length || !existing[0].values.length) return false;
    const currentVersion = existing[0].values[0][0] as number;
    if (input.version !== currentVersion) throw new Error('Optimistic lock conflict: version mismatch');
    const sets: string[] = [];
    const params: any[] = [];
    if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title); }
    if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description); }
    if (input.type !== undefined) { sets.push('type = ?'); params.push(input.type); }
    if (input.priority !== undefined) { sets.push('priority = ?'); params.push(input.priority); }
    if (input.assignee !== undefined) { sets.push('assignee = ?'); params.push(input.assignee); }
    if (input.milestoneId !== undefined) { sets.push('milestone_id = ?'); params.push(input.milestoneId); }
    if (input.labels !== undefined) { sets.push('labels = ?'); params.push(JSON.stringify(input.labels)); }
    sets.push('version = version + 1');
    sets.push('updated_at = datetime("now")');
    params.push(id);
    db.run(`UPDATE work_items SET ${sets.join(', ')} WHERE id = ?`, params);
    await saveDatabase();
    return true;
  }

  async updateStatus(id: string, toStatus: WorkItemStatus, changedBy?: string, wipLimit?: number, currentCount?: number): Promise<boolean> {
    const db = getDatabase();
    const existing = db.exec(`SELECT status FROM work_items WHERE id = ?`, [id]);
    if (!existing.length || !existing[0].values.length) return false;
    const fromStatus = existing[0].values[0][0] as WorkItemStatus;
    const wipCheck = wipLimit !== undefined && currentCount !== undefined
      ? { columnStatus: toStatus, currentCount, wipLimit, exceeded: currentCount >= wipLimit }
      : undefined;
    const log = this.stateMachine.transition(id, fromStatus, toStatus, changedBy, wipCheck);
    const closedAt = toStatus === 'closed' ? new Date().toISOString() : null;
    if (closedAt) {
      db.run(`UPDATE work_items SET status = ?, updated_at = datetime("now"), closed_at = ? WHERE id = ?`, [toStatus, closedAt, id]);
    } else {
      db.run(`UPDATE work_items SET status = ?, updated_at = datetime("now") WHERE id = ?`, [toStatus, id]);
    }
    db.run(`INSERT INTO status_change_logs (work_item_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?)`,
      [id, fromStatus, toStatus, changedBy || '']);
    await saveDatabase();
    return true;
  }

  async deleteWorkItem(id: string): Promise<void> {
    const db = getDatabase();
    db.run(`DELETE FROM work_items WHERE id = ?`, [id]);
    await saveDatabase();
  }

  async linkCommit(workItemId: string, commitSha: string, commitMessage: string): Promise<void> {
    const db = getDatabase();
    const linkedIds = this.stateMachine.parseLinkedIds(commitMessage);
    const ids = linkedIds.length > 0 ? linkedIds : [workItemId];
    for (const wiId of ids) {
      db.run(`INSERT OR IGNORE INTO work_item_commits (work_item_id, commit_sha, commit_message) VALUES (?, ?, ?)`, [wiId, commitSha, commitMessage]);
    }
    await saveDatabase();
  }

  async getBoard(): Promise<{ columns: BoardColumn[]; workItems: any[] }> {
    const db = getDatabase();
    const colsResult = db.exec(`SELECT * FROM board_columns WHERE project_path = ? ORDER BY position`, [this.projectPath]);
    const columns: BoardColumn[] = [];
    if (colsResult.length && colsResult[0].values.length) {
      const cols = colsResult[0].columns;
      colsResult[0].values.forEach(row => {
        const obj: any = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        columns.push(obj);
      });
    }
    if (columns.length === 0) {
      const defaultCols = [
        { id: 'col_todo', name: '待办', status: 'todo', wipLimit: null, position: 0 },
        { id: 'col_in_progress', name: '进行中', status: 'in_progress', wipLimit: 5, position: 1 },
        { id: 'col_done', name: '已完成', status: 'done', wipLimit: null, position: 2 },
        { id: 'col_closed', name: '已关闭', status: 'closed', wipLimit: null, position: 3 },
      ];
      for (const col of defaultCols) {
        db.run(`INSERT OR IGNORE INTO board_columns (id, name, status, wip_limit, position, project_path) VALUES (?, ?, ?, ?, ?, ?)`,
          [col.id, col.name, col.status, col.wipLimit, col.position, this.projectPath]);
        columns.push({ ...col, projectPath: this.projectPath } as BoardColumn);
      }
      await saveDatabase();
    }
    const workItems = await this.listWorkItems();
    return { columns, workItems };
  }

  async updateWipLimit(columnId: string, wipLimit: number): Promise<void> {
    const db = getDatabase();
    db.run(`UPDATE board_columns SET wip_limit = ? WHERE id = ?`, [wipLimit, columnId]);
    await saveDatabase();
  }

  async listMilestones(): Promise<any[]> {
    const db = getDatabase();
    const result = db.exec(`SELECT * FROM milestones WHERE project_path = ? ORDER BY created_at`, [this.projectPath]);
    if (!result.length || !result[0].values.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }

  async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    const workItems = await this.listWorkItems();
    if (format === 'csv') {
      if (workItems.length === 0) return '';
      const headers = Object.keys(workItems[0]);
      const rows = workItems.map(item => headers.map(h => JSON.stringify(item[h] ?? '')).join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    return JSON.stringify(workItems, null, 2);
  }
}
