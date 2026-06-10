import React, { useState } from 'react';
import { useSecurityStore } from '../../stores/security-store';

interface SecurityRuleEditorProps {
  projectPath: string;
}

export const SecurityRuleEditor: React.FC<SecurityRuleEditorProps> = ({ projectPath }) => {
  const { customRules, loadRules, saveRule, deleteRule } = useSecurityStore();
  const [editing, setEditing] = useState<any>(null);

  React.useEffect(() => { loadRules(projectPath); }, [projectPath]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs text-gray-400 font-medium">安全规则</h3>
        <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setEditing({ id: '', name: '', vulnerabilityType: 'xss', pattern: '', severity: 'high', languages: [], message: '' })}>新增规则</button>
      </div>
      {editing && (
        <div className="bg-gray-800 rounded p-2 space-y-2">
          <input className="w-full bg-gray-900 rounded px-2 py-1 text-xs text-gray-200" placeholder="规则名称" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
          <input className="w-full bg-gray-900 rounded px-2 py-1 text-xs text-gray-200 font-mono" placeholder="正则模式" value={editing.pattern} onChange={e => setEditing({ ...editing, pattern: e.target.value })} />
          <input className="w-full bg-gray-900 rounded px-2 py-1 text-xs text-gray-200" placeholder="描述" value={editing.message} onChange={e => setEditing({ ...editing, message: e.target.value })} />
          <div className="flex gap-2">
            <button className="text-xs text-green-400" onClick={() => { saveRule(projectPath, editing); setEditing(null); }}>保存</button>
            <button className="text-xs text-gray-400" onClick={() => setEditing(null)}>取消</button>
          </div>
        </div>
      )}
      <div className="space-y-1 max-h-60 overflow-auto">
        {customRules.map((rule: any) => (
          <div key={rule.id} className="flex items-center gap-2 text-xs bg-gray-800/50 rounded px-2 py-1">
            <span className="text-gray-300 flex-1 truncate">{rule.name}</span>
            <span className="text-gray-600">{rule.vulnerability_type || rule.vulnerabilityType}</span>
            {!rule.builtin && <button className="text-red-400 hover:text-red-300" onClick={() => deleteRule(projectPath, rule.id)}>删除</button>}
          </div>
        ))}
      </div>
    </div>
  );
};
