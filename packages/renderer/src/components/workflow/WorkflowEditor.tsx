import React, { useState, useCallback, useRef, useEffect } from 'react';

interface WorkflowNode {
  id: string;
  type: 'phase' | 'connector' | 'trigger';
  label: string;
  x: number;
  y: number;
  config?: any;
}

interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

interface WorkflowEditorProps {
  workflowId?: string;
  onSave?: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  onExecute?: () => void;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  workflowId,
  onSave,
  onExecute
}) => {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const addNode = useCallback((type: WorkflowNode['type'], label: string) => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      label,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    };
    setNodes(prev => [...prev, newNode]);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId));
    setSelectedNode(null);
  }, []);

  const addEdge = useCallback((from: string, to: string, label?: string) => {
    const newEdge: WorkflowEdge = {
      id: `edge-${Date.now()}`,
      from,
      to,
      label,
    };
    setEdges(prev => [...prev, newEdge]);
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setDraggedNode(nodeId);
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y,
    });
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedNode) return;
    
    setNodes(prev => prev.map(node => 
      node.id === draggedNode
        ? { ...node, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
        : node
    ));
  }, [draggedNode, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setDraggedNode(null);
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(nodes, edges);
  }, [nodes, edges, onSave]);

  const getNodeColor = (type: WorkflowNode['type']) => {
    switch (type) {
      case 'phase': return '#3b82f6';
      case 'connector': return '#10b981';
      case 'trigger': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <div className="workflow-editor">
      <div className="toolbar">
        <button onClick={() => addNode('phase', '阶段节点')} className="btn-phase">
          + 阶段节点
        </button>
        <button onClick={() => addNode('connector', '连接器节点')} className="btn-connector">
          + 连接器节点
        </button>
        <button onClick={() => addNode('trigger', '触发器节点')} className="btn-trigger">
          + 触发器节点
        </button>
        <button onClick={handleSave} className="btn-save">
          保存
        </button>
        <button onClick={onExecute} className="btn-execute">
          执行
        </button>
      </div>

      <div className="canvas-container">
        <div
          ref={canvasRef}
          className="canvas"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg className="edges-layer" style={{ width: '100%', height: '100%' }}>
            {edges.map(edge => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              
              return (
                <g key={edge.id}>
                  <line
                    x1={fromNode.x + 60}
                    y1={fromNode.y + 30}
                    x2={toNode.x + 60}
                    y2={toNode.y + 30}
                    stroke="#94a3b8"
                    strokeWidth="2"
                  />
                  {edge.label && (
                    <text
                      x={(fromNode.x + toNode.x) / 2 + 60}
                      y={(fromNode.y + toNode.y) / 2 + 30}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="12"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="nodes-layer">
            {nodes.map(node => (
              <div
                key={node.id}
                className={`node ${selectedNode === node.id ? 'selected' : ''}`}
                style={{
                  left: node.x,
                  top: node.y,
                  borderColor: getNodeColor(node.type),
                }}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onClick={() => setSelectedNode(node.id)}
              >
                <div className="node-header" style={{ backgroundColor: getNodeColor(node.type) }}>
                  {node.type === 'phase' && '🔷'}
                  {node.type === 'connector' && '⚡'}
                  {node.type === 'trigger' && '🔔'}
                  <span>{node.label}</span>
                </div>
                <div className="node-body">
                  {node.config && (
                    <div className="node-config">
                      {Object.entries(node.config).map(([key, value]) => (
                        <div key={key}>{key}: {String(value)}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .workflow-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e293b;
        }
        .toolbar {
          display: flex;
          gap: 8px;
          padding: 12px;
          background: #0f172a;
          border-bottom: 1px solid #334155;
        }
        .toolbar button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-phase { background: #3b82f6; color: white; }
        .btn-connector { background: #10b981; color: white; }
        .btn-trigger { background: #f59e0b; color: white; }
        .btn-save { background: #6b7280; color: white; }
        .btn-execute { background: #ef4444; color: white; }
        .canvas-container {
          flex: 1;
          overflow: hidden;
        }
        .canvas {
          width: 100%;
          height: 100%;
          position: relative;
          background-image: radial-gradient(#334155 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .edges-layer {
          position: absolute;
          pointer-events: none;
        }
        .nodes-layer {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        .node {
          position: absolute;
          width: 120px;
          background: #1e293b;
          border: 2px solid;
          border-radius: 8px;
          cursor: move;
          user-select: none;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        .node.selected {
          box-shadow: 0 0 0 2px #fff, 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        .node-header {
          padding: 8px;
          border-radius: 6px 6px 0 0;
          color: white;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .node-body {
          padding: 8px;
          font-size: 12px;
          color: #94a3b8;
        }
        .node-config {
          font-size: 11px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};
