import React, { useState } from 'react';
import { useSecurityStore } from '../../stores/security-store';

interface ScanComparisonProps {
  projectPath: string;
}

export const ScanComparison: React.FC<ScanComparisonProps> = ({ projectPath }) => {
  const { scanHistory, listResults, compareResults } = useSecurityStore();
  const [scanId1, setScanId1] = useState('');
  const [scanId2, setScanId2] = useState('');
  const [result, setResult] = useState<any>(null);

  React.useEffect(() => { listResults(projectPath); }, [projectPath]);

  const handleCompare = async () => {
    if (!scanId1 || !scanId2) return;
    const r = await compareResults(projectPath, scanId1, scanId2);
    setResult(r);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs text-gray-400 font-medium">基线对比</h3>
      <div className="flex items-center gap-2">
        <select className="bg-gray-900 rounded px-2 py-1 text-xs text-gray-200 flex-1" value={scanId1} onChange={e => setScanId1(e.target.value)}>
          <option value="">选择扫描1</option>
          {scanHistory.map((s: any) => <option key={s.id} value={s.id}>{s.id} ({s.scanned_at?.slice(0, 19)})</option>)}
        </select>
        <span className="text-gray-500">vs</span>
        <select className="bg-gray-900 rounded px-2 py-1 text-xs text-gray-200 flex-1" value={scanId2} onChange={e => setScanId2(e.target.value)}>
          <option value="">选择扫描2</option>
          {scanHistory.map((s: any) => <option key={s.id} value={s.id}>{s.id} ({s.scanned_at?.slice(0, 19)})</option>)}
        </select>
        <button className="px-2 py-1 text-xs bg-blue-600 text-white rounded" onClick={handleCompare}>对比</button>
      </div>
      {result && (
        <div className="bg-gray-800 rounded p-3 space-y-1 text-xs">
          <div className="text-red-400">新增漏洞: {result.added}</div>
          <div className="text-green-400">修复漏洞: {result.fixed}</div>
          <div className="text-yellow-400">残留漏洞: {result.remaining}</div>
        </div>
      )}
    </div>
  );
};
