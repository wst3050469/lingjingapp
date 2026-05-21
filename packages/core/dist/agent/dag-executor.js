import { StructuredError } from '../errors/index.js';
export class DAGExecutor {
    detectCycle(nodes) {
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
        const visited = new Set();
        const recursionStack = new Set();
        const path = [];
        for (const node of nodes) {
            if (!visited.has(node.id)) {
                const cycle = this.dfs(node.id, nodeMap, visited, recursionStack, path);
                if (cycle)
                    return cycle;
            }
        }
        return null;
    }
    async execute(nodes) {
        const cycle = this.detectCycle(nodes);
        if (cycle) {
            throw new StructuredError(`Cycle detected in DAG: ${cycle.join(' -> ')}`, {
                errorCode: 'AGENT_TIMEOUT',
                recoverable: false,
            });
        }
        const results = new Map();
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
        const completed = new Set();
        const executing = new Set();
        while (completed.size < nodes.length) {
            const ready = [];
            for (const node of nodes) {
                if (completed.has(node.id) || executing.has(node.id))
                    continue;
                const depsReady = node.dependencies.every((dep) => completed.has(dep));
                if (depsReady) {
                    ready.push(node);
                }
            }
            if (ready.length === 0 && executing.size === 0) {
                throw new StructuredError('DAG execution stalled: no ready nodes and none executing', {
                    recoverable: false,
                });
            }
            const promises = ready.map(async (node) => {
                executing.add(node.id);
                try {
                    const result = await node.execute();
                    results.set(node.id, result);
                    completed.add(node.id);
                }
                finally {
                    executing.delete(node.id);
                }
            });
            await Promise.allSettled(promises);
            for (const node of ready) {
                if (!results.has(node.id)) {
                    completed.add(node.id);
                }
            }
        }
        return results;
    }
    topologicalSort(nodes) {
        const cycle = this.detectCycle(nodes);
        if (cycle) {
            throw new Error(`Cannot topologically sort: cycle detected (${cycle.join(' -> ')})`);
        }
        const sorted = [];
        const visited = new Set();
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
        const visit = (id) => {
            if (visited.has(id))
                return;
            visited.add(id);
            const node = nodeMap.get(id);
            if (node) {
                for (const dep of node.dependencies) {
                    visit(dep);
                }
                sorted.push(id);
            }
        };
        for (const node of nodes) {
            visit(node.id);
        }
        return sorted;
    }
    dfs(id, nodeMap, visited, recursionStack, path) {
        visited.add(id);
        recursionStack.add(id);
        path.push(id);
        const node = nodeMap.get(id);
        if (node) {
            for (const dep of node.dependencies) {
                if (!visited.has(dep)) {
                    const cycle = this.dfs(dep, nodeMap, visited, recursionStack, path);
                    if (cycle)
                        return cycle;
                }
                else if (recursionStack.has(dep)) {
                    const cycleStart = path.indexOf(dep);
                    return [...path.slice(cycleStart), dep];
                }
            }
        }
        path.pop();
        recursionStack.delete(id);
        return null;
    }
}
//# sourceMappingURL=dag-executor.js.map