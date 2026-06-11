import { PipelineEngine, DslParser, TriggerManager } from '@codepilot/core/pipeline';
import type { PipelineDefinition, PipelineRun, PipelineLogEvent } from '@codepilot/core/pipeline';
import { getDatabase, saveDatabase } from '../db/database.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';

export class PipelineService {
  private engine: PipelineEngine;
  private dslParser: DslParser;
  private triggerManager: TriggerManager;
  private projectPath: string;

  constructor(projectPath: string, onLog?: (event: PipelineLogEvent) => void) {
    this.projectPath = projectPath;
    this.engine = new PipelineEngine({
      onLog,
      onStatusChange: () => {},
      onDangerousCommand: async () => false,
    });
    this.dslParser = new DslParser();
    this.triggerManager = new TriggerManager();
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
    const yamlDir = join(this.projectPath, '.lingjing', 'pipelines');
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
  }

  async triggerPipeline(pipelineId: string, triggerType: 'manual' | 'push' | 'cron' = 'manual'): Promise<PipelineRun> {
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

  dispose(): void {
    this.engine.dispose();
    this.triggerManager.dispose();
  }
}
