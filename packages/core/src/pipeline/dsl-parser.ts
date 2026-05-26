import YAML from 'yaml';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { PipelineDefinition, PipelineTrigger, PipelineStage, PipelineTask, TaskType } from './types.js';

export class DslParser {
    async parseDirectory(dir: string): Promise<PipelineDefinition[]> {
        if (!existsSync(dir)) return [];

        const files = await readdir(dir);
        const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        const results: PipelineDefinition[] = [];

        for (const file of yamlFiles) {
            try {
                const content = await readFile(join(dir, file), 'utf-8');
                const def = this.parseYaml(content, join(dir, file));
                if (def) results.push(def);
            } catch (err) {
                console.error(`[DSL] Failed to parse ${file}:`, err);
            }
        }
        return results;
    }

    parseYaml(content: string, yamlPath: string = ''): PipelineDefinition {
        const raw = YAML.parse(content);
        if (!raw || !raw.name || !raw.stages || !Array.isArray(raw.stages) || raw.stages.length === 0) {
            throw new Error('Invalid pipeline YAML: missing name or stages');
        }

        const orders = raw.stages.map((s: any) => s.order);
        if (new Set(orders).size !== orders.length) {
            throw new Error('Invalid pipeline YAML: stage orders must be unique');
        }

        const triggers: PipelineTrigger[] = (raw.triggers || []).map((t: any) => {
            const trigger: PipelineTrigger = { type: t.type };
            if (t.type === 'push') trigger.branches = t.branches || [];
            if (t.type === 'cron') {
                if (!t.expression) throw new Error('Cron trigger requires expression');
                trigger.expression = t.expression;
            }
            return trigger;
        });

        const stages: PipelineStage[] = raw.stages.map((s: any) => ({
            name: s.name,
            order: s.order,
            continueOnError: s.continueOnError ?? false,
            tasks: (s.tasks || []).map((t: any) => ({
                name: t.name,
                type: (t.type || 'custom') as TaskType,
                command: t.command || '',
                timeout: t.timeout,
                env: t.env,
                continueOnError: t.continueOnError,
                workingDirectory: t.workingDirectory,
                sshHost: t.sshHost,
            })),
        }));

        return {
            id: raw.id || `pipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: raw.name,
            triggers,
            stages,
            yamlPath,
        };
    }

    toYaml(def: PipelineDefinition): string {
        const obj: any = {
            name: def.name,
            id: def.id,
            triggers: def.triggers.map(t => {
                const entry: any = { type: t.type };
                if (t.type === 'push') entry.branches = t.branches;
                if (t.type === 'cron') entry.expression = t.expression;
                return entry;
            }),
            stages: def.stages.map(s => ({
                name: s.name,
                order: s.order,
                continueOnError: s.continueOnError,
                tasks: s.tasks.map(t => {
                    const task: any = { name: t.name, type: t.type, command: t.command };
                    if (t.timeout) task.timeout = t.timeout;
                    if (t.env) task.env = t.env;
                    if (t.continueOnError) task.continueOnError = t.continueOnError;
                    if (t.workingDirectory) task.workingDirectory = t.workingDirectory;
                    if (t.sshHost) task.sshHost = t.sshHost;
                    return task;
                }),
            })),
        };
        return YAML.stringify(obj);
    }
}
