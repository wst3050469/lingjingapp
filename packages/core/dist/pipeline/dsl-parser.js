"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DslParser = void 0;
const yaml_1 = __importDefault(require("yaml"));
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_fs_1 = require("node:fs");
class DslParser {
    async parseDirectory(dir) {
        if (!(0, node_fs_1.existsSync)(dir))
            return [];
        const files = await (0, promises_1.readdir)(dir);
        const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        const results = [];
        for (const file of yamlFiles) {
            try {
                const content = await (0, promises_1.readFile)((0, node_path_1.join)(dir, file), 'utf-8');
                const def = this.parseYaml(content, (0, node_path_1.join)(dir, file));
                if (def)
                    results.push(def);
            }
            catch (err) {
                console.error(`[DSL] Failed to parse ${file}:`, err);
            }
        }
        return results;
    }
    parseYaml(content, yamlPath = '') {
        const raw = yaml_1.default.parse(content);
        if (!raw || !raw.name || !raw.stages || !Array.isArray(raw.stages) || raw.stages.length === 0) {
            throw new Error('Invalid pipeline YAML: missing name or stages');
        }
        const orders = raw.stages.map((s) => s.order);
        if (new Set(orders).size !== orders.length) {
            throw new Error('Invalid pipeline YAML: stage orders must be unique');
        }
        const triggers = (raw.triggers || []).map((t) => {
            const trigger = { type: t.type };
            if (t.type === 'push')
                trigger.branches = t.branches || [];
            if (t.type === 'cron') {
                if (!t.expression)
                    throw new Error('Cron trigger requires expression');
                trigger.expression = t.expression;
            }
            return trigger;
        });
        const stages = raw.stages.map((s) => ({
            name: s.name,
            order: s.order,
            continueOnError: s.continueOnError ?? false,
            tasks: (s.tasks || []).map((t) => ({
                name: t.name,
                type: (t.type || 'custom'),
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
    toYaml(def) {
        const obj = {
            name: def.name,
            id: def.id,
            triggers: def.triggers.map(t => {
                const entry = { type: t.type };
                if (t.type === 'push')
                    entry.branches = t.branches;
                if (t.type === 'cron')
                    entry.expression = t.expression;
                return entry;
            }),
            stages: def.stages.map(s => ({
                name: s.name,
                order: s.order,
                continueOnError: s.continueOnError,
                tasks: s.tasks.map(t => {
                    const task = { name: t.name, type: t.type, command: t.command };
                    if (t.timeout)
                        task.timeout = t.timeout;
                    if (t.env)
                        task.env = t.env;
                    if (t.continueOnError)
                        task.continueOnError = t.continueOnError;
                    if (t.workingDirectory)
                        task.workingDirectory = t.workingDirectory;
                    if (t.sshHost)
                        task.sshHost = t.sshHost;
                    return task;
                }),
            })),
        };
        return yaml_1.default.stringify(obj);
    }
}
exports.DslParser = DslParser;
//# sourceMappingURL=dsl-parser.js.map