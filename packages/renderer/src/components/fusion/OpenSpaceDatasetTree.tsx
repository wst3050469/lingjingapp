import React, { useState, useEffect } from 'react';

interface DatasetNode {
  id: string;
  name: string;
  type: 'folder' | 'dataset' | 'scene';
  children?: DatasetNode[];
  size?: string;
}

export function OpenSpaceDatasetTree() {
  const [datasets, setDatasets] = useState<DatasetNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    setLoading(true);
    try {
      const result = await (window as any).electron?.invoke('openspace:browse-datasets');
      setDatasets(result || []);
    } catch { setDatasets([]); }
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderNode = (node: DatasetNode, depth: number = 0) => (
    <div key={node.id}>
      <div className="flex items-center gap-1 px-2 py-1 hover:bg-cp-surfaceHover cursor-pointer" style={{ paddingLeft: `${depth * 16 + 8}px` }} onClick={() => node.type === 'folder' && toggleExpand(node.id)}>
        {node.type === 'folder' && (
          <span className="text-xs text-cp-text-dim">{expanded.has(node.id) ? '▼' : '▶'}</span>
        )}
        <span className={`text-xs ${node.type === 'folder' ? 'text-cp-accent' : node.type === 'scene' ? 'text-purple-400' : 'text-cp-text'}`}>
          {node.name}
        </span>
        {node.size && <span className="text-xs text-cp-text-dim/50 ml-auto">{node.size}</span>}
      </div>
      {node.type === 'folder' && expanded.has(node.id) && node.children?.map(c => renderNode(c, depth + 1))}
    </div>
  );

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-cp-text">数据集浏览器</h2>
        <button onClick={loadDatasets} disabled={loading} className="text-xs text-cp-accent hover:underline disabled:opacity-50">
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {datasets.length === 0 ? (
          <div className="text-cp-text-dim/50 text-xs text-center py-8">暂无数据集</div>
        ) : datasets.map(d => renderNode(d))}
      </div>
    </div>
  );
}
