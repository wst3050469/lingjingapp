import React, { useState, useEffect } from 'react';

interface DAGNodeView {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  x: number;
  y: number;
}

interface DAGEdgeView {
  from: string;
  to: string;
}

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'fill-gray-300',
  running: 'fill-yellow-400',
  completed: 'fill-green-500',
  failed: 'fill-red-500',
  skipped: 'fill-gray-400',
};

export const DAGCanvas: React.FC = () => {
  const [nodes, setNodes] = useState<DAGNodeView[]>([]);
  const [edges, setEdges] = useState<DAGEdgeView[]>([]);
  const [dagId, setDagId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const pollStatus = async () => {
    if (!dagId) return;
    try {
      const status = await window.electronAPI?.invoke('fusion:dag:status', dagId) as any;
      if (status?.nodeStatuses) {
        setNodes((prev) =>
          prev.map((n) => ({
            ...n,
            status: status.nodeStatuses[n.taskId] ?? n.status,
          }))
        );
      }
    } catch {}
  };

  useEffect(() => {
    if (!dagId || !executing) return;
    const interval = setInterval(pollStatus, 1000);
    return () => clearInterval(interval);
  }, [dagId, executing]);

  const handleExecute = async () => {
    if (nodes.length === 0) return;
    setExecuting(true);
    try {
      const result = await window.electronAPI?.invoke('fusion:dag:execute', {
        id: 'manual',
        nodes: nodes.map((n) => ({ taskId: n.taskId, taskDef: { name: n.taskId, prompt: '' }, dependencies: [] })),
        edges: edges.map((e) => ({ from: e.from, to: e.to })),
      }, {});
      if (result) {
        setDagId((result as any).dagId);
      }
    } catch {} finally {
      setExecuting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">DAG编排画布</h2>
        <button
          onClick={handleExecute}
          disabled={executing || nodes.length === 0}
          className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
        >
          {executing ? '执行中...' : '执行DAG'}
        </button>
      </div>

      <svg className="w-full h-96 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
        {edges.map((edge, i) => {
          const fromNode = nodes.find((n) => n.taskId === edge.from);
          const toNode = nodes.find((n) => n.taskId === edge.to);
          if (!fromNode || !toNode) return null;
          return (
            <line
              key={i}
              x1={fromNode.x + 60}
              y1={fromNode.y + 20}
              x2={toNode.x + 60}
              y2={toNode.y + 20}
              className="stroke-gray-400 dark:stroke-gray-500"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
            />
          );
        })}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" className="fill-gray-400" />
          </marker>
        </defs>
        {nodes.map((node) => (
          <g key={node.taskId} transform={`translate(${node.x}, ${node.y})`}>
            <rect width={120} height={40} rx={6} className={`${STATUS_COLORS[node.status]} stroke-gray-500`} strokeWidth={1} />
            <text x={60} y={25} textAnchor="middle" className="text-xs fill-gray-800 dark:fill-gray-200" fontSize={11}>
              {node.taskId}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
