import { PipelineEngine, DslParser, TriggerManager } from '@codepilot/core/pipeline';
import type { PipelineDefinition, PipelineRun, PipelineLogEvent, WatchConfig } from '@codepilot/core/pipeline';
import { getDatabase, saveDatabase } from '../db/database.js';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { existsSync, watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';

export class PipelineService {
  private engine: PipelineEngine;
  private dslParser: DslParser;
  private triggerManager: TriggerManager;
  private projectPath: string;
  private watchers: FSWatcher[] = [];
  private watchTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(projectPath: string, onLog?: (event: PipelineLogEvent) => void) {
    this.projectPath = projectPath;
    this.engine = new PipelineEngine({
      onLog,
      onStatusChange: () => {},
      onDangerousCommand: async () => false,
    });
    this.dslParser = new DslParser();
    this.triggerManager = new TriggerManager({
      onTrigger: (pipelineId, triggerType, info) => {
        this.triggerPipeline(pipelineId, triggerType as any).catch(err => {
          console.error(`[Pipeline] Auto-trigger failed for ${pipelineId}:`, err);
        });
      },
    });
  }

  getTriggerManager(): TriggerManager {
    return this.triggerManager;
  }

  getEngine(): PipelineEngine {
    return this.engine;
  }

  getDslParser(): DslParser {
    return this.dslParser;
  }

  /** 获取 pipeline YAML 配置目录 */
  getPipelinesDir(): string {
    return join(this.projectPath, '.lingjing', 'pipelines');
  }

  /** 自动扫描 .lingjing/pipelines/ 目录，加载所有 pipeline 并注册触发器 */
  async autoLoadPipelines(): Promise<PipelineDefinition[]> {
    const yamlDir = this.getPipelinesDir();
    if (!existsSync(yamlDir)) {
      await mkdir(yamlDir, { recursive: true });
      return [];
    }

    const definitions = await this.dslParser.parseDirectory(yamlDir);
    for (const def of definitions) {
      // 保存到数据库
      await this.savePipeline(def);
      // 注册触发条件
      this.triggerManager.addPipeline(def);

      // 注册文件变更监听
      const watchTriggers = def.triggers.filter(t => t.type === 'watch');
      if (watchTriggers.length > 0) {
        this.registerWatchTriggers(def);
      }
    }
    return definitions;
  }

  /** 为 pipeline 注册文件变更监听器 */
  private registerWatchTriggers(definition: PipelineDefinition): void {
    this.triggerManager.registerWatchTrigger(
      definition,
      (config: WatchConfig, cb: (event: { filePath: string; type: 'change' | 'add' | 'unlink' }) => void) => {
        return this.startFileWatcher(config, cb);
      },
    );
  }

  /** 启动 fs.watch 文件监听 */
  private startFileWatcher(
    config: WatchConfig,
    cb: (event: { filePath: string; type: 'change' | 'add' | 'unlink' }) => void,
  ): () => void {
    const debounceMs = config.debounceMs ?? 1000;
    const watchEvents = config.events ?? ['change', 'add', 'unlink'];
    const recursive = config.recursive ?? true;
    const watchers: FSWatcher[] = [];

    for (const rawPath of config.paths) {
      // 支持相对路径（相对于项目根目录）和绝对路径
      const watchDir = resolve(this.projectPath, rawPath);
      if (!existsSync(watchDir)) {
        console.warn(`[Pipeline] Watch path does not exist, skipping: ${watchDir}`);
        continue;
      }

      try {
        const w = watch(watchDir, { recursive }, (eventType, filename) => {
          if (!filename) return;

          const fullPath = join(watchDir, filename.toString());
          const fileEvent = eventType as 'change' | 'rename';

          // 归一化事件类型
          const normalizedEvent = fileEvent === 'rename' ? 'unlink' : 'change';

          if (!watchEvents.includes(normalizedEvent as any)) return;

          // 如果配置了 patterns，检查文件名是否匹配
          if (config.patterns && config.patterns.length > 0) {
            const matched = config.patterns.some(pattern => {
              const relPath = relative(watchDir, fullPath);
              // 简单通配符匹配：仅支持 * 和 **
              const regex = new RegExp(
                '^' + pattern
                  .replace(/\*\*/g, '(.+)')
                  .replace(/\*/g, '([^/]+)')
                  .replace(/\./g, '\\.') + '$',
              );
              return regex.test(relPath) || regex.test(filename.toString());
            });
            if (!matched) return;
          }

          // 防抖处理
          const debounceKey = `${watchDir}:${fullPath}`;
          const existing = this.watchTimers.get(debounceKey);
          if (existing) clearTimeout(existing);

          this.watchTimers.set(debounceKey, setTimeout(() => {
            this.watchTimers.delete(debounceKey);
            cb({ filePath: fullPath, type: normalizedEvent as 'change' | 'add' | 'unlink' });
          }, debounceMs));
        });

        watchers.push(w);
        this.watchers.push(w);
        console.log(`[Pipeline] Watching: ${watchDir} (recursive=${recursive}, debounce=${debounceMs}ms)`);
      } catch (err) {
        console.error(`[Pipeline] Failed to watch ${watchDir}:`, err);
      }
    }

    // 返回取消监听的函数
    return () => {
      for (const w of watchers) {
        const idx = this.watchers.indexOf(w);
        if (idx !== -1) this.watchers.splice(idx, 1);
        w.close();
      }
    };
  }

  async listPipelines(): Promise<any[]> {
    const db = getDatabase();
    const result = db.exec(`SELECT * FROM pipelines WHERE project_path = ?`, [this.projectPath]);
    if (!result.length || !result[0].values.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }

  async savePipeline(definition: PipelineDefinition): Promise<void> {
    const db = getDatabase();
    const yamlContent = this.dslParser.toYaml(definition);
    const yamlDir = this.getPipelinesDir();
    if (!existsSync(yamlDir)) await mkdir(yamlDir, { recursive: true });
    const yamlPath = join(yamlDir, `${definition.id}.yaml`);
    await writeFile(yamlPath, yamlContent, 'utf-8');
    const triggers = JSON.stringify(definition.triggers);
    db.run(`INSERT OR REPLACE INTO pipelines (id, name, yaml_path, definition, triggers, project_path) VALUES (?, ?, ?, ?, ?, ?)`,
      [definition.id, definition.name, yamlPath, yamlContent, triggers, this.projectPath]);
    await saveDatabase();
  }

  async deletePipeline(id: string): Promise<void> {
    const db = getDatabase();
    db.run(`DELETE FROM pipelines WHERE id = ?`, [id]);
    await saveDatabase();
    this.triggerManager.removePipeline(id);
  }

  async triggerPipeline(pipelineId: string, triggerType: 'manual' | 'push' | 'cron' | 'watch' = 'manual'): Promise<PipelineRun> {
    const db = getDatabase();
    const result = db.exec(`SELECT definition FROM pipelines WHERE id = ?`, [pipelineId]);
    if (!result.length || !result[0].values.length) throw new Error('Pipeline not found');
    const yamlContent = result[0].values[0][0] as string;
    const definition = this.dslParser.parseYaml(yamlContent);
    if (!definition) throw new Error('Invalid pipeline definition');
    const run = await this.engine.execute(definition, triggerType);
    db.run(`INSERT INTO pipeline_runs (id, pipeline_id, trigger_type, trigger_info, status, stages_result, started_at, finished_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [run.id, run.pipelineId, run.triggerType, run.triggerInfo || '', run.status, JSON.stringify(run.stagesResult), run.startedAt, run.finishedAt, run.durationMs]);
    await saveDatabase();
    return run;
  }

  async cancelPipeline(runId: string): Promise<void> {
    this.engine.cancel(runId);
    const db = getDatabase();
    db.run(`UPDATE pipeline_runs SET status = 'cancelled', finished_at = ? WHERE id = ?`, [new Date().toISOString(), runId]);
    await saveDatabase();
  }

  async getRunHistory(pipelineId: string, limit: number = 20): Promise<any[]> {
    const db = getDatabase();
    const result = db.exec(`SELECT * FROM pipeline_runs WHERE pipeline_id = ? ORDER BY created_at DESC LIMIT ?`, [pipelineId, limit]);
    if (!result.length || !result[0].values.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }

  async getRunDetail(runId: string): Promise<any> {
    const db = getDatabase();
    const result = db.exec(`SELECT * FROM pipeline_runs WHERE id = ?`, [runId]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const row = result[0].values[0];
    const obj: any = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  }

  /** 获取所有活跃的文件监听状态 */
  getWatchStatus(): Array<{ dir: string; active: boolean }> {
    return this.watchers.map(w => ({
      dir: (w as any).path || 'unknown',
      active: true,
    }));
  }

  dispose(): void {
    // 关闭所有文件监听器
    for (const w of this.watchers) {
      try { w.close(); } catch { /* ignore */ }
    }
    this.watchers = [];
    // 清除所有防抖定时器
    for (const t of this.watchTimers.values()) clearTimeout(t);
    this.watchTimers.clear();
    this.engine.dispose();
    this.triggerManager.dispose();
  }
}