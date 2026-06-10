import React, { useState } from 'react';
import { useSecurityStore } from '../../stores/security-store';
import { VulnerabilityCard } from './VulnerabilityCard';
import { SecurityRuleEditor } from './SecurityRuleEditor';
import { ScanComparison } from './ScanComparison';

interface SecurityPanelProps {
  projectPath: string;
}

export const SecurityPanel: React.FC<SecurityPanelProps> = ({ projectPath }) => {
  const { currentResult, loading, progress, scan, cancelScan } = useSecurityStore();
  const [scope, setScope] = useState<'full' | 'incremental' | 'specified'>('full');
  const [activeTab, setActiveTab] = useState<'scan' | 'rules' | 'compare'>('scan');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-gray-200">安全扫描</h2>
          <div className="flex text-xs">
            <button className={`px-2 py-0.5 rounded-l ${activeTab === 'scan' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400'}`} onClick={() => setActiveTab('scan')}>扫描</button>
            <button className={`px-2 py-0.5 ${activeTab === 'rules' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400'}`} onClick={() => setActiveTab('rules')}>规则</button>
            <button className={`px-2 py-0.5 rounded-r ${activeTab === 'compare' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400'}`} onClick={() => setActiveTab('compare')}>对比</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select className="bg-gray-800 rounded px-2 py-1 text-xs text-gray-200" value={scope} onChange={e => setScope(e.target.value as any)}>
            <option value="full">全量扫描</option>
            <option value="incremental">增量扫描</option>
          </select>
          {loading ? (
            <button className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500" onClick={() => cancelScan(projectPath)}>取消</button>
          ) : (
            <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500" onClick={() => scan(projectPath, scope)}>扫描</button>
          )}
        </div>
      </div>
      {progress && (
        <div className="px-3 py-1 bg-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{progress.phase}: {progress.filePath || ''}</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
            <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${progress.total ? (progress.current / progress.total * 100) : 0}%` }} />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'scan' && (
          currentResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-400">漏洞: <span className="text-red-400 font-bold">{currentResult.summary?.total || 0}</span></span>
                {currentResult.summary?.bySeverity && Object.entries(currentResult.summary.bySeverity).map(([sev, count]: any) => (
                  <span key={sev} className="text-gray-500">{sev}: {count}</span>
                ))}
                <span className="text-gray-600 ml-auto">{currentResult.durationMs}ms</span>
              </div>
              {(currentResult.vulnerabilities || []).length === 0 ? (
                <div className="text-center text-green-400 text-sm py-8">扫描完成，未发现漏洞</div>
              ) : (
                <div className="space-y-2">
                  {currentResult.vulnerabilities.map((v: any, i: number) => (
                    <VulnerabilityCard key={i} vulnerability={v} projectPath={projectPath} />
                  ))}
                </div>
              )}
            </div>
          ) : <div className="text-center text-gray-500 text-sm py-8">点击"扫描"开始安全检查</div>
        )}
        {activeTab === 'rules' && <SecurityRuleEditor projectPath={projectPath} />}
        {activeTab === 'compare' && <ScanComparison projectPath={projectPath} />}
      </div>
    </div>
  );
};
