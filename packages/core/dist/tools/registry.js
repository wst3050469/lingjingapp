// Tool Registry - manages tool registration and lookup
import { toolToSchema } from './types.js';
export class ToolRegistry {
    tools = new Map();
    mcpSourceMap = new Map();
    initializedSet = new Set();
    register(tool, mcpServerName) {
        this.tools.set(tool.name, tool);
        if (mcpServerName) {
            this.mcpSourceMap.set(tool.name, mcpServerName);
        }
    }
    get(name) {
        return this.tools.get(name);
    }
    has(name) {
        return this.tools.has(name);
    }
    getAll() {
        return Array.from(this.tools.values());
    }
    getSchemas() {
        return this.getAll().map(toolToSchema);
    }
    getSubset(names) {
        const subset = new ToolRegistry();
        for (const name of names) {
            const tool = this.tools.get(name);
            if (tool)
                subset.register(tool);
        }
        return subset;
    }
    remove(name) {
        this.mcpSourceMap.delete(name);
        this.initializedSet.delete(name);
        return this.tools.delete(name);
    }
    unregisterByMcpServer(mcpServerName) {
        let count = 0;
        for (const [toolName, source] of this.mcpSourceMap) {
            if (source === mcpServerName) {
                this.tools.delete(toolName);
                this.mcpSourceMap.delete(toolName);
                this.initializedSet.delete(toolName);
                count++;
            }
        }
        return count;
    }
    getMcpSource(toolName) {
        return this.mcpSourceMap.get(toolName);
    }
    getByMcpServer(mcpServerName) {
        const result = [];
        for (const [toolName, source] of this.mcpSourceMap) {
            if (source === mcpServerName) {
                const tool = this.tools.get(toolName);
                if (tool)
                    result.push(tool);
            }
        }
        return result;
    }
    async initializeTool(name) {
        const tool = this.tools.get(name);
        if (!tool)
            throw new Error(`Tool not found: ${name}`);
        if (this.initializedSet.has(name))
            return;
        if (tool.lifecycle?.initialize) {
            await tool.lifecycle.initialize();
        }
        this.initializedSet.add(name);
    }
    async disposeTool(name) {
        const tool = this.tools.get(name);
        if (!tool)
            return;
        if (tool.lifecycle?.dispose) {
            await tool.lifecycle.dispose();
        }
        this.initializedSet.delete(name);
    }
    async disposeAll() {
        const promises = [];
        for (const name of this.initializedSet) {
            promises.push(this.disposeTool(name));
        }
        await Promise.allSettled(promises);
    }
    get size() {
        return this.tools.size;
    }
}
//# sourceMappingURL=registry.js.map