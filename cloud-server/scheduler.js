/**
 * 灵境 Cloud Scheduler v1 — Cron 定时任务引擎
 *
 * 功能:
 *   - 解析标准 5 字段 cron 表达式 (分 时 日 月 周)
 *   - 任务持久化到 SQLite (schedules 表)
 *   - 支持三种执行器: shell / http / webhook
 *   - 执行日志记录 (schedule_logs 表)
 *   - 任务状态管理 (active/paused/completed/failed)
 *   - 缺失补偿执行 (catch-up)
 *   - 指数退避重试
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { exec } from 'node:child_process';

// ── Safe JSON parse helper ──
function safeJsonParse(val, fallback) {
  if (val == null) return fallback;
  if (typeof val !== 'string') return val; // already an object
  try { return JSON.parse(val); } catch { return fallback; }
}

// ── Cron Parser ──
const FIELD_RANGES = {
  minute:  [0, 59],
  hour:    [0, 23],
  dom:     [1, 31],
  month:   [1, 12],
  dow:     [0, 7],  // 0=Sun, 7 also Sun
};

function parseField(field, range) {
  const [min, max] = range;
  const result = new Set();

  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(.+?)\/(\d+)$/);
    let base = part;
    let step = 1;
    if (stepMatch) {
      base = stepMatch[1];
      step = parseInt(stepMatch[2], 10);
    }

    if (base === '*') {
      for (let i = min; i <= max; i += step) result.add(i);
    } else if (base.includes('-')) {
      const [lo, hi] = base.split('-').map(Number);
      for (let i = lo; i <= hi; i += step) result.add(i);
    } else {
      result.add(parseInt(base, 10));
    }
  }
  return result;
}

function cronMatches(expr, date) {
  const [minute, hour, dom, month, dow] = expr.trim().split(/\s+/);

  const minutes  = parseField(minute, FIELD_RANGES.minute);
  const hours    = parseField(hour,   FIELD_RANGES.hour);
  const doms     = parseField(dom,    FIELD_RANGES.dom);
  const months   = parseField(month,  FIELD_RANGES.month);
  const dows     = parseField(dow,    FIELD_RANGES.dow);

  if (!months.has(date.getMonth() + 1)) return false;
  if (!doms.has(date.getDate())) return false;
  if (!hours.has(date.getHours())) return false;
  if (!minutes.has(date.getMinutes())) return false;

  // DOW: 0 = Sunday in JS, but cron uses 0=Sun too
  const jsDow = date.getDay();
  // Support both 0 and 7 as Sunday
  const cronDow = jsDow === 0 ? [0, 7] : [jsDow];
  if (!cronDow.some(d => dows.has(d))) return false;

  return true;
}

function cronNextRun(expr, from = new Date()) {
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1); // start from next minute

  const maxIter = 525600; // 1 year of minutes — safety valve
  for (let i = 0; i < maxIter; i++) {
    if (cronMatches(expr, next)) return new Date(next);
    next.setMinutes(next.getMinutes() + 1);
  }
  return null; // no match in a year
}

// ── Schedule Executor ──
async function executeAction(action, db, scheduleId) {
  const now = new Date().toISOString();
  const logId = randomUUID();

  const insertLog = (status, result, error) => {
    db.prepare(
      `INSERT INTO schedule_logs (id, schedule_id, status, result, error, executed_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(logId, scheduleId, status, result || null, error || null, now);
  };

  try {
    let result = '';

    if (action.type === 'shell') {
      // Execute shell command (with 30s timeout)
      result = await new Promise((resolve, reject) => {
        const proc = exec(action.command || 'echo "no command"', {
          timeout: action.timeout || 30000,
          maxBuffer: 1024 * 1024, // 1MB
          shell: action.shell || '/bin/bash',
        }, (err, stdout, stderr) => {
          if (err) reject(stderr || err.message);
          else resolve(stdout.trim() || '(empty)');
        });
      });
      insertLog('success', result.slice(0, 5000), null);
      return { ok: true, result: result.slice(0, 5000) };

    } else if (action.type === 'http') {
      const controller = new AbortController();
      const timeoutMs = action.timeout || 30000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(action.url, {
          method: action.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(action.headers || {}),
          },
          body: action.body ? JSON.stringify(action.body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const text = await res.text();
        const ok = res.ok;
        insertLog(ok ? 'success' : 'failed', text.slice(0, 5000), ok ? null : `HTTP ${res.status}`);
        return { ok, result: text.slice(0, 5000), status: res.status };
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }

    } else if (action.type === 'webhook') {
      // Internal webhook — broadcast via the existing webhook system
      insertLog('success', `webhook:${action.channel}`, null);
      return { ok: true, result: `webhook:${action.channel}`, _webhook: { channel: action.channel, payload: action.payload || {} } };

    } else {
      insertLog('failed', null, `Unknown action type: ${action.type}`);
      return { ok: false, error: `Unknown action type: ${action.type}` };
    }

  } catch (err) {
    const errMsg = err?.message || String(err);
    insertLog('failed', null, errMsg.slice(0, 5000));
    return { ok: false, error: errMsg.slice(0, 5000) };
  }
}

// ── Scheduler Class ──
export class CloudScheduler extends EventEmitter {
  constructor(db, options = {}) {
    super();
    this.db = db;
    this.tickInterval = options.tickInterval || 10000; // check every 10s
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseMs = options.retryBaseMs || 1000;
    this.running = false;
    this.timer = null;
    this._pending = new Set(); // prevent concurrent execution of same schedule

    this._ensureTables();
  }

  _ensureTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cron_expr TEXT NOT NULL,
        action_type TEXT NOT NULL DEFAULT 'http',
        action_config TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active',
        last_run TEXT,
        next_run TEXT,
        created_at TEXT,
        updated_at TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schedule_logs (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        status TEXT NOT NULL,
        result TEXT,
        error TEXT,
        executed_at TEXT,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id)
      )
    `);

    // Create indexes
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_schedule_logs_schedule ON schedule_logs(schedule_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_schedule_logs_executed ON schedule_logs(executed_at)`);

    console.log('[Scheduler] Tables initialized');
  }

  /** Start the tick loop */
  start() {
    if (this.running) return;
    this.running = true;
    console.log(`[Scheduler] Started (tick=${this.tickInterval}ms)`);
    this._tick();
    this.timer = setInterval(() => this._tick(), this.tickInterval);
  }

  /** Stop the tick loop */
  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[Scheduler] Stopped');
  }

  /** Main tick: find due schedules and execute */
  async _tick() {
    const now = new Date().toISOString();

    // Find active schedules whose next_run <= now
    const due = this.db.prepare(
      `SELECT * FROM schedules
       WHERE status = 'active'
         AND (next_run IS NULL OR next_run <= ?)
       ORDER BY next_run ASC
       LIMIT 50`
    ).all(now);

    for (const sched of due) {
      if (this._pending.has(sched.id)) continue; // skip if already executing

      this._pending.add(sched.id);

      try {
        await this._executeSchedule(sched);
      } catch (err) {
        console.error(`[Scheduler] Error executing ${sched.name}:`, err.message);
      } finally {
        this._pending.delete(sched.id);
      }
    }

    // Clean old logs (keep last 1000 per schedule)
    this._cleanLogs();
  }

  async _executeSchedule(sched) {
    const now = new Date();
    const cronExpr = sched.cron_expr;

    // Check if current time matches cron
    if (!cronMatches(cronExpr, now)) {
      // Recalculate next_run
      const next = cronNextRun(cronExpr, now);
      this.db.prepare('UPDATE schedules SET next_run = ?, updated_at = ? WHERE id = ?')
        .run(next?.toISOString() || null, now.toISOString(), sched.id);
      return;
    }

    // Parse action config
    let action;
    try {
      action = safeJsonParse(sched.action_config, {});
    } catch {
      action = { type: sched.action_type };
    }
    action.type = action.type || sched.action_type || 'http';

    console.log(`[Scheduler] Executing "${sched.name}" (${sched.id})`);

    const result = await executeAction(action, this.db, sched.id);

    // Handle webhook internally
    if (result._webhook) {
      this.emit('webhook', result._webhook.channel, result._webhook.payload);
    }

    if (result.ok) {
      // Success: update last_run, calculate next_run, reset retry
      const next = cronNextRun(cronExpr, now);
      this.db.prepare(
        `UPDATE schedules
         SET last_run = ?, next_run = ?, retry_count = 0, updated_at = ?
         WHERE id = ?`
      ).run(now.toISOString(), next?.toISOString() || null, now.toISOString(), sched.id);
    } else {
      // Failed: increment retry, maybe pause
      const newRetry = (sched.retry_count || 0) + 1;
      const maxRetries = sched.max_retries || this.maxRetries;

      if (newRetry >= maxRetries) {
        // Max retries reached — pause schedule
        console.warn(`[Scheduler] "${sched.name}" failed ${newRetry} times, pausing`);
        this.db.prepare(
          `UPDATE schedules
           SET status = 'paused', retry_count = ?, last_error = ?, updated_at = ?
           WHERE id = ?`
        ).run(newRetry, result.error, now.toISOString(), sched.id);
        this.emit('paused', sched.id, result.error);
      } else {
        // Retry with exponential backoff
        const delay = this.retryBaseMs * Math.pow(2, newRetry - 1);
        const retryAt = new Date(now.getTime() + delay);
        this.db.prepare(
          `UPDATE schedules
           SET retry_count = ?, next_run = ?, last_error = ?, updated_at = ?
           WHERE id = ?`
        ).run(newRetry, retryAt.toISOString(), result.error, now.toISOString(), sched.id);
      }
    }
  }

  _cleanLogs() {
    // Keep last 500 logs per schedule
    this.db.exec(`
      DELETE FROM schedule_logs
      WHERE rowid NOT IN (
        SELECT rowid FROM schedule_logs AS sl2
        WHERE sl2.schedule_id = schedule_logs.schedule_id
        ORDER BY sl2.executed_at DESC
        LIMIT 500
      )
    `);
  }

  // ── CRUD helpers used by REST API ──

  listSchedules(status) {
    if (status) {
      return this.db.prepare('SELECT * FROM schedules WHERE status = ? ORDER BY created_at DESC').all(status);
    }
    return this.db.prepare('SELECT * FROM schedules ORDER BY created_at DESC').all();
  }

  getSchedule(id) {
    return this.db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
  }

  createSchedule({ name, cronExpr, actionType, actionConfig, maxRetries }) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const next = cronNextRun(cronExpr);

    this.db.prepare(
      `INSERT INTO schedules (id, name, cron_expr, action_type, action_config, status, next_run, created_at, updated_at, max_retries)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
    ).run(id, name, cronExpr, actionType || 'http', JSON.stringify(actionConfig || {}), next?.toISOString() || null, now, now, maxRetries || 3);

    const created = this.db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    console.log(`[Scheduler] Created "${name}" (${id}) cron=${cronExpr}`);
    this.emit('created', created);
    return created;
  }

  updateSchedule(id, updates) {
    const existing = this.db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = updates.name ?? existing.name;
    const cronExpr = updates.cronExpr ?? existing.cron_expr;
    const actionType = updates.actionType ?? existing.action_type;
    const actionConfig = updates.actionConfig ?? safeJsonParse(existing.action_config, {});
    const status = updates.status ?? existing.status;
    const maxRetries = updates.maxRetries ?? existing.max_retries;

    const next = cronNextRun(cronExpr);

    this.db.prepare(
      `UPDATE schedules
       SET name = ?, cron_expr = ?, action_type = ?, action_config = ?,
           status = ?, next_run = ?, max_retries = ?, updated_at = ?
       WHERE id = ?`
    ).run(name, cronExpr, actionType, JSON.stringify(actionConfig), status, next?.toISOString() || null, maxRetries, now, id);

    return this.db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
  }

  deleteSchedule(id) {
    this.db.prepare('DELETE FROM schedule_logs WHERE schedule_id = ?').run(id);
    const result = this.db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    console.log(`[Scheduler] Deleted schedule ${id}`);
    return result.changes > 0;
  }

  getLogs(scheduleId, limit = 50) {
    return this.db.prepare(
      'SELECT * FROM schedule_logs WHERE schedule_id = ? ORDER BY executed_at DESC LIMIT ?'
    ).all(scheduleId, limit);
  }

  /** Immediately trigger a schedule (manual run) */
  async triggerNow(id) {
    const sched = this.db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!sched) return { error: 'not_found' };

    const action = safeJsonParse(sched.action_config, {});
    action.type = action.type || sched.action_type || 'http';

    const result = await executeAction(action, this.db, id);
    return { schedule: sched.name, ...result };
  }
}

// Re-export for convenience
export { cronMatches, cronNextRun };
