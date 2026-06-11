import React, { useState } from 'react';
import { usePMStore } from '../../stores/pm-store';

interface WorkItemFormProps {
  projectPath: string;
  initial?: any;
  onClose: () => void;
}

export const WorkItemForm: React.FC<WorkItemFormProps> = ({ projectPath, initial, onClose }) => {
  const { createWorkItem } = usePMStore();
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    type: initial?.type || 'task',
    priority: initial?.priority || 'medium',
    assignee: initial?.assignee || '',
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    await createWorkItem(projectPath, form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-4 w-96 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-medium text-gray-200">{initial ? '编辑工作项' : '新建工作项'}</h3>
        <input className="w-full bg-gray-900 rounded px-2 py-1.5 text-sm text-gray-200" placeholder="标题" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <textarea className="w-full bg-gray-900 rounded px-2 py-1.5 text-sm text-gray-200 h-20 resize-none" placeholder="描述" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <div className="flex gap-2">
          <select className="bg-gray-900 rounded px-2 py-1 text-xs text-gray-200" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="task">任务</option><option value="bug">缺陷</option><option value="feature">特性</option><option value="story">故事</option>
          </select>
          <select className="bg-gray-900 rounded px-2 py-1 text-xs text-gray-200" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="critical">紧急</option>
          </select>
        </div>
        <input className="w-full bg-gray-900 rounded px-2 py-1.5 text-xs text-gray-200" placeholder="指派人" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} />
        <div className="flex gap-2 justify-end">
          <button className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200" onClick={onClose}>取消</button>
          <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500" onClick={handleSubmit}>{initial ? '保存' : '创建'}</button>
        </div>
      </div>
    </div>
  );
};
