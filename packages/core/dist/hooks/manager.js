import { readFileSync, existsSync } from 'fs';
export class HooksManager {
    hooks = new Map();
    configPath;
    constructor(configPath) {
        this.configPath = configPath;
        if (configPath) {
            this.loadConfig(configPath);
        }
    }
    register(definition) {
        const eventHooks = this.hooks.get(definition.event) || [];
        eventHooks.push(definition);
        eventHooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        this.hooks.set(definition.event, eventHooks);
    }
    unregister(name) {
        let found = false;
        for (const [event, hooks] of this.hooks.entries()) {
            const index = hooks.findIndex(h => h.name === name);
            if (index >= 0) {
                hooks.splice(index, 1);
                found = true;
            }
        }
        return found;
    }
    async trigger(event, context) {
        const hooks = this.hooks.get(event) || [];
        for (const hook of hooks) {
            if (hook.enabled === false) {
                continue;
            }
            try {
                await hook.handler(context);
            }
            catch (error) {
                console.error(`Hook "${hook.name}" failed for event "${event}":`, error);
            }
        }
    }
    async triggerParallel(event, context) {
        const hooks = this.hooks.get(event) || [];
        const enabledHooks = hooks.filter(h => h.enabled !== false);
        await Promise.all(enabledHooks.map(async (hook) => {
            try {
                await hook.handler(context);
            }
            catch (error) {
                console.error(`Hook "${hook.name}" failed for event "${event}":`, error);
            }
        }));
    }
    loadConfig(configPath) {
        try {
            if (!existsSync(configPath)) {
                return;
            }
            const content = readFileSync(configPath, 'utf-8');
            const config = this.parseConfig(content);
            for (const hookDef of config.hooks) {
                this.register(hookDef);
            }
        }
        catch (error) {
            console.error(`Failed to load hooks config from ${configPath}:`, error);
        }
    }
    parseConfig(content) {
        if (content.trim().startsWith('{')) {
            return JSON.parse(content);
        }
        return this.parseYaml(content);
    }
    parseYaml(content) {
        const lines = content.split('\n');
        const hooks = [];
        let currentHook = null;
        let inHooks = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (trimmed === 'hooks:' || trimmed === '- hooks:') {
                inHooks = true;
                continue;
            }
            if (inHooks && trimmed.startsWith('- name:')) {
                if (currentHook && currentHook.name && currentHook.event && currentHook.handler) {
                    hooks.push(currentHook);
                }
                currentHook = {
                    name: trimmed.replace('- name:', '').trim().replace(/['"]/g, ''),
                };
                continue;
            }
            if (currentHook) {
                if (trimmed.startsWith('event:')) {
                    currentHook.event = trimmed.replace('event:', '').trim();
                }
                else if (trimmed.startsWith('priority:')) {
                    currentHook.priority = parseInt(trimmed.replace('priority:', '').trim());
                }
                else if (trimmed.startsWith('enabled:')) {
                    currentHook.enabled = trimmed.replace('enabled:', '').trim() === 'true';
                }
            }
        }
        if (currentHook && currentHook.name && currentHook.event) {
            hooks.push(currentHook);
        }
        return { hooks };
    }
    getHooks(event) {
        if (event) {
            return this.hooks.get(event) || [];
        }
        const allHooks = [];
        for (const hooks of this.hooks.values()) {
            allHooks.push(...hooks);
        }
        return allHooks;
    }
    clear() {
        this.hooks.clear();
    }
}
export function createDefaultHooksManager() {
    const manager = new HooksManager();
    manager.register({
        name: 'log-file-changes',
        event: 'onFileChange',
        priority: 100,
        handler: async (context) => {
            console.log(`[Hook] File changed: ${context.filePath}`);
        },
    });
    manager.register({
        name: 'log-agent-start',
        event: 'onAgentStart',
        priority: 100,
        handler: async (context) => {
            console.log(`[Hook] Agent started: ${context.agentType}`);
        },
    });
    return manager;
}
//# sourceMappingURL=manager.js.map