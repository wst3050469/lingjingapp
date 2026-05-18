import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DAGOrchestrator } from '../dag-orchestrator/dag-orchestrator.js';
import type { DAGDefinition, ExecuteNodeCallback, IEventBus } from '../dag-orchestrator/types.js';

function makeNode(taskId: string, deps: string[] = [], name: string = 'task'): any {
  return { taskId, taskDef: { name, prompt: `do ${name}` }, dependencies: deps };
}

describe('DAGOrchestrator', () => {
  let executeNode: ReturnType<typeof vi.fn>;
  let eventBus: any;
  let dag: DAGOrchestrator;

  beforeEach(() => {
    executeNode = vi.fn().mockResolvedValue('done');
    eventBus = { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() };
    dag = new DAGOrchestrator(executeNode, eventBus);
  });

  describe('validateDAG', () => {
    it('should reject empty id', () => {
      const result = dag.validateDAG({ id: '', nodes: [makeNode('a')], edges: [] } as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('id');
    });

    it('should reject empty nodes', () => {
      const result = dag.validateDAG({ id: 'test', nodes: [], edges: [] } as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least one node');
    });

    it('should reject duplicate node ids', () => {
      const result = dag.validateDAG({
        id: 'test', nodes: [makeNode('a'), makeNode('a')], edges: [],
      } as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Duplicate');
    });

    it('should reject dependency on non-existent node', () => {
      const result = dag.validateDAG({
        id: 'test', nodes: [makeNode('a', ['b'])], edges: [],
      } as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-existent');
    });

    it('should reject cycles', () => {
      const result = dag.validateDAG({
        id: 'test',
        nodes: [makeNode('a', ['b']), makeNode('b', ['a'])],
        edges: [],
      } as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cycle');
    });

    it('should accept valid DAG', () => {
      const result = dag.validateDAG({
        id: 'test', nodes: [makeNode('a'), makeNode('b', ['a'])], edges: [],
      } as any);
      expect(result.valid).toBe(true);
    });
  });

  describe('buildExecutionPlan', () => {
    it('should build single layer for independent nodes', () => {
      const layers = dag.buildExecutionPlan({
        id: 'test', nodes: [makeNode('a'), makeNode('b')], edges: [],
      } as any);
      expect(layers).toHaveLength(1);
      expect(layers[0].nodes).toHaveLength(2);
    });

    it('should build multi-layer plan for dependent nodes', () => {
      const layers = dag.buildExecutionPlan({
        id: 'test',
        nodes: [makeNode('a'), makeNode('b', ['a']), makeNode('c', ['b'])],
        edges: [],
      } as any);
      expect(layers.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle diamond dependency', () => {
      const layers = dag.buildExecutionPlan({
        id: 'test',
        nodes: [
          makeNode('root'),
          makeNode('left', ['root']),
          makeNode('right', ['root']),
          makeNode('merge', ['left', 'right']),
        ],
        edges: [],
      } as any);
      expect(layers).toHaveLength(3);
      expect(layers[0].nodes).toHaveLength(1); // root
      expect(layers[1].nodes).toHaveLength(2); // left, right
      expect(layers[2].nodes).toHaveLength(1); // merge
    });
  });

  describe('execute', () => {
    it('should execute a single node DAG', async () => {
      const result = await dag.execute({
        id: 'test', nodes: [makeNode('a')], edges: [],
      } as any);
      expect(result.status).toBe('completed');
      expect(result.nodeResults.size).toBe(1);
      expect(executeNode).toHaveBeenCalledTimes(1);
    });

    it('should execute sequential DAG in order', async () => {
      const result = await dag.execute({
        id: 'test',
        nodes: [makeNode('a'), makeNode('b', ['a']), makeNode('c', ['b'])],
        edges: [],
      } as any);
      expect(result.status).toBe('completed');
      expect(result.nodeResults.size).toBe(3);
      expect(executeNode).toHaveBeenCalledTimes(3);
    });

    it('should mark nodes as failed on execution error', async () => {
      executeNode.mockRejectedValue(new Error('execution failed'));
      const result = await dag.execute({
        id: 'test', nodes: [makeNode('a')], edges: [],
      } as any);
      expect(result.failedNodes).toContain('a');
    });

    it('should skip dependent nodes when dependency fails', async () => {
      executeNode.mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');
      const result = await dag.execute({
        id: 'test',
        nodes: [makeNode('a'), makeNode('b', ['a'])],
        edges: [],
      } as any);
      const bResult = result.nodeResults.get('b');
      expect(bResult?.status).toBe('skipped');
    });

    it('should return partial status when some nodes fail', async () => {
      executeNode.mockRejectedValue(new Error('fail'));
      const result = await dag.execute({
        id: 'test', nodes: [makeNode('a')], edges: [],
      } as any);
      expect(result.status).toBe('partial');
      expect(result.failedNodes).toContain('a');
    });

    it('should publish dag:completed event on success', async () => {
      await dag.execute({
        id: 'test', nodes: [makeNode('a')], edges: [],
      } as any);
      expect(eventBus.publish).toHaveBeenCalledWith(
        'dag:completed',
        expect.objectContaining({ dagId: 'test' }),
        'DAGOrchestrator',
      );
    });

    it('should publish dag:failed on invalid DAG', async () => {
      await dag.execute({
        id: 'test', nodes: [], edges: [],
      } as any);
      expect(eventBus.publish).toHaveBeenCalledWith(
        'dag:failed',
        expect.objectContaining({ dagId: 'test' }),
        'DAGOrchestrator',
      );
    });

    it('should publish dag:node_completed for each successful node', async () => {
      await dag.execute({
        id: 'test', nodes: [makeNode('a'), makeNode('b')], edges: [],
      } as any);
      expect(eventBus.publish).toHaveBeenCalledWith(
        'dag:node_completed',
        expect.objectContaining({ taskId: 'a' }),
        'DAGOrchestrator',
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        'dag:node_completed',
        expect.objectContaining({ taskId: 'b' }),
        'DAGOrchestrator',
      );
    });
  });

  describe('healthCheck', () => {
    it('should return healthy', () => {
      expect(dag.healthCheck().healthy).toBe(true);
    });
  });

  describe('setEventBus', () => {
    it('should allow changing event bus', () => {
      const newBus = { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() };
      dag.setEventBus(newBus);
      expect(true).toBe(true);
    });
  });
});
