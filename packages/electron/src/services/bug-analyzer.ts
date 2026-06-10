import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { getDatabase, saveDatabase } from '../db/database.js';
import type { BugRecord, BugSeverity, BugStatus } from '../db/types/ide-enhance-types.js';

const logger = createLogger('bug-analyzer');

interface KnownBug {
  id: string;
  severity: BugSeverity;
  module: string;
  title: string;
  description: string;
  affectedFiles: string[];
}

const KNOWN_BUGS: KnownBug[] = [
  {
    id: 'BUG-001',
    severity: 'HIGH',
    module: 'memory',
    title: '跨会话记忆搜索Bug',
    description: 'searchMemories() 方法使用 category="expert-learning" 硬编码过滤，导致搜索结果遗漏其他分类的记忆',
    affectedFiles: ['packages/core/src/memory/', 'packages/electron/src/services/memory-service.ts'],
  },
  {
    id: 'BUG-002',
    severity: 'HIGH',
    module: 'memory',
    title: '云端记忆搜索缺失',
    description: 'Agent 启动时未拉取云端记忆，语义搜索无法返回跨设备结果',
    affectedFiles: ['packages/electron/src/services/memory-service.ts', 'packages/electron/src/ipc/memory-ipc.ts'],
  },
  {
    id: 'BUG-003',
    severity: 'CRITICAL',
    module: 'agent',
    title: '会话中断Bug',
    description: 'Agent 主循环无心跳超时检测，对话执行任务过程中无征兆断开，需用户重新提示才可继续',
    affectedFiles: ['packages/core/src/agent/agent.ts', 'packages/electron/src/services/agent-session-manager.ts'],
  },
  {
    id: 'BUG-004',
    severity: 'MEDIUM',
    module: 'web-server',
    title: '移动端API缺失',
    description: 'WebSocket 缺少 approval/agent/chat.answer 等通道，移动端无法审批操作和管理Agent',
    affectedFiles: ['packages/electron/src/web-server.ts'],
  },
];

export class BugAnalyzer extends EventEmitter {
  classify(bugs: BugRecord[]): Map<string, BugRecord[]> {
    const map = new Map<string, BugRecord[]>();
    for (const bug of bugs) {
      const key = `${bug.severity}::${bug.module}`;
      const list = map.get(key) ?? [];
      list.push(bug);
      map.set(key, list);
    }
    return map;
  }

  prioritize(bugs: BugRecord[]): BugRecord[] {
    const order: Record<BugSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return [...bugs].sort((a, b) => (order[a.severity] ?? 99) - (order[b.severity] ?? 99));
  }

  identifyKnown(): KnownBug[] {
    return KNOWN_BUGS;
  }

  async scanFromDb(): Promise<BugRecord[]> {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM bug_records ORDER BY severity ASC, updated_at DESC');
      const results: BugRecord[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        results.push({
          id: row.id,
          severity: row.severity,
          module: row.module,
          title: row.title,
          description: row.description ?? '',
          status: row.status,
          fixDescription: row.fix_description ?? '',
          affectedFiles: JSON.parse(row.affected_files ?? '[]'),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
      stmt.free();
      return results;
    } catch (err) {
      logger.error('Failed to scan bugs from DB', err as Error);
      return [];
    }
  }
}

export const bugAnalyzer = new BugAnalyzer();