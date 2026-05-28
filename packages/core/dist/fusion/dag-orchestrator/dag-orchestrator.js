"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAGOrchestrator = void 0;
const logger_js_1 = require("../../utils/logger.js");
class DAGOrchestrator {
    eventBus = null;
    executeNode;
    healthy = true;
    constructor(executeNode, eventBus) {
        this.executeNode = executeNode;
        if (eventBus)
            this.eventBus = eventBus;
    }
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }
    validateDAG(dag) {
        if (!dag.id)
            return { valid: false, error: 'DAG id is required' };
        if (!dag.nodes || dag.nodes.length === 0)
            return { valid: false, error: 'DAG must have at least one node' };
        const nodeIds = new Set(dag.nodes.map((n) => n.taskId));
        const duplicates = dag.nodes.map((n) => n.taskId).filter((id, i, arr) => arr.indexOf(id) !== i);
        if (duplicates.length > 0)
            return { valid: false, error: `Duplicate node ids: ${duplicates.join(',')}` };
        for (const node of dag.nodes) {
            for (const dep of node.dependencies) {
                if (!nodeIds.has(dep))
                    return { valid: false, error: `Node ${node.taskId} depends on non-existent node ${dep}` };
            }
        }
        const visited = new Set();
        const recursionStack = new Set();
        const nodeMap = new Map(dag.nodes.map((n) => [n.taskId, n]));
        const hasCycle = (nodeId) => {
            visited.add(nodeId);
            recursionStack.add(nodeId);
            const node = nodeMap.get(nodeId);
            if (node) {
                for (const dep of node.dependencies) {
                    if (!visited.has(dep)) {
                        if (hasCycle(dep))
                            return true;
                    }
                    else if (recursionStack.has(dep)) {
                        return true;
                    }
                }
            }
            recursionStack.delete(nodeId);
            return false;
        };
        for (const nodeId of nodeIds) {
            if (!visited.has(nodeId)) {
                if (hasCycle(nodeId))
                    return { valid: false, error: 'DAG contains a cycle' };
            }
        }
        return { valid: true };
    }
    buildExecutionPlan(dag) {
        const inDegree = new Map();
        const nodeMap = new Map(dag.nodes.map((n) => [n.taskId, n]));
        for (const node of dag.nodes) {
            inDegree.set(node.taskId, node.dependencies.length);
        }
        const layers = [];
        const assigned = new Set();
        let layerIndex = 0;
        while (assigned.size < dag.nodes.length) {
            const layerNodes = [];
            for (const node of dag.nodes) {
                if (!assigned.has(node.taskId) && inDegree.get(node.taskId) === 0) {
                    layerNodes.push(node);
                }
            }
            if (layerNodes.length === 0)
                break;
            layers.push({ nodes: layerNodes, index: layerIndex });
            for (const node of layerNodes) {
                assigned.add(node.taskId);
                for (const candidate of dag.nodes) {
                    if (candidate.dependencies.includes(node.taskId)) {
                        inDegree.set(candidate.taskId, (inDegree.get(candidate.taskId) ?? 0) - 1);
                    }
                }
            }
            layerIndex++;
        }
        return layers;
    }
    evaluateCondition(condition, context) {
        if (!condition)
            return true;
        const value = condition.expression.split('.').reduce((obj, key) => obj?.[key], context);
        return value === condition.expectedValue;
    }
    async executeNodeWithRetry(taskDef, context, retryPolicy) {
        const maxRetries = retryPolicy?.maxRetries ?? 0;
        const retryDelay = retryPolicy?.retryDelay ?? 0;
        let lastError = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const start = Date.now();
            try {
                const output = await this.executeNode(taskDef, context);
                return { taskId: '', status: 'completed', output, duration: Date.now() - start };
            }
            catch (err) {
                lastError = err;
                logger_js_1.logger.warn(`[DAGOrchestrator] node execution attempt ${attempt + 1} failed: ${lastError.message}`);
                if (attempt < maxRetries && retryDelay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                }
            }
        }
        return {
            taskId: '',
            status: 'failed',
            output: lastError?.message ?? 'Unknown error',
            duration: 0,
        };
    }
    async execute(dag, context) {
        const startTime = Date.now();
        const validation = this.validateDAG(dag);
        if (!validation.valid) {
            const result = {
                dagId: dag.id,
                nodeResults: new Map(),
                failedNodes: [],
                totalTime: Date.now() - startTime,
                status: 'failed',
            };
            this.eventBus?.publish('dag:failed', { dagId: dag.id, error: validation.error }, 'DAGOrchestrator');
            return result;
        }
        const layers = this.buildExecutionPlan(dag);
        const nodeResults = new Map();
        const failedNodes = new Set();
        const skippedNodes = new Set();
        const maxConcurrency = dag.maxConcurrency ?? Infinity;
        for (const layer of layers) {
            const readyNodes = layer.nodes.filter((node) => {
                if (node.dependencies.some((dep) => failedNodes.has(dep) || skippedNodes.has(dep))) {
                    skippedNodes.add(node.taskId);
                    nodeResults.set(node.taskId, {
                        taskId: node.taskId,
                        status: 'skipped',
                        output: '',
                        duration: 0,
                    });
                    return false;
                }
                return this.evaluateCondition(node.condition, context);
            });
            if (readyNodes.length === 0)
                continue;
            const batches = [];
            for (let i = 0; i < readyNodes.length; i += maxConcurrency) {
                batches.push(readyNodes.slice(i, i + maxConcurrency));
            }
            for (const batch of batches) {
                const results = await Promise.allSettled(batch.map(async (node) => {
                    const start = Date.now();
                    const taskResult = await this.executeNodeWithRetry(node.taskDef, context, dag.retryPolicy);
                    taskResult.taskId = node.taskId;
                    taskResult.duration = Date.now() - start;
                    return { taskId: node.taskId, result: taskResult };
                }));
                for (const settled of results) {
                    if (settled.status === 'fulfilled') {
                        const { taskId, result } = settled.value;
                        nodeResults.set(taskId, result);
                        if (result.status === 'failed') {
                            failedNodes.add(taskId);
                        }
                        else {
                            this.eventBus?.publish('dag:node_completed', { dagId: dag.id, taskId, status: result.status }, 'DAGOrchestrator');
                        }
                    }
                    else {
                        const node = batch.find((n) => !nodeResults.has(n.taskId));
                        if (node) {
                            const taskResult = {
                                taskId: node.taskId,
                                status: 'failed',
                                output: settled.reason?.message ?? 'Unknown error',
                                duration: 0,
                            };
                            nodeResults.set(node.taskId, taskResult);
                            failedNodes.add(node.taskId);
                        }
                    }
                }
            }
        }
        const totalTime = Date.now() - startTime;
        const status = failedNodes.size === 0 ? 'completed' : skippedNodes.size === dag.nodes.length ? 'failed' : 'partial';
        const dagResult = {
            dagId: dag.id,
            nodeResults,
            failedNodes: [...failedNodes],
            totalTime,
            status,
        };
        if (status === 'completed') {
            this.eventBus?.publish('dag:completed', dagResult, 'DAGOrchestrator');
        }
        else {
            this.eventBus?.publish('dag:failed', dagResult, 'DAGOrchestrator');
        }
        return dagResult;
    }
    healthCheck() {
        return { healthy: this.healthy };
    }
}
exports.DAGOrchestrator = DAGOrchestrator;
//# sourceMappingURL=dag-orchestrator.js.map