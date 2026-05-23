// Quest Spec Tab - markdown spec viewer/editor with approve/reject

import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useQuestStore } from '../../stores/quest-store';

export function QuestSpecTab() {
  const { specContent, activeTaskId, specStatus, messages } = useQuestStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const hasAgentRun = messages.length > 0;

  const handleEdit = () => {
    setEditText(specContent || '');
    setIsEditing(true);
  };

  const handleSave = useCallback(async () => {
    if (!activeTaskId) return;
    useQuestStore.getState().setSpecContent(editText);
    try {
      await window.electronAPI.quest.updateSpec(activeTaskId, editText);
    } catch { /* ignore */ }
    setIsEditing(false);
  }, [editText, activeTaskId]);

  const handleCancel = () => {
    setIsEditing(false);
    setEditText('');
  };

  const handleApprove = async () => {
    if (!activeTaskId) return;
    useQuestStore.getState().setSpecStatus('approved');
    try {
      await window.electronAPI.quest.sendIntervention(activeTaskId, 'Spec approved. Proceed with implementation.');
    } catch { /* ignore */ }
  };

  const handleReject = async () => {
    if (!activeTaskId) return;
    useQuestStore.getState().setSpecStatus('rejected');
    try {
      await window.electronAPI.quest.sendIntervention(activeTaskId, 'Spec rejected. Please revise the spec based on the following feedback: needs revision.');
    } catch { /* ignore */ }
  };

  if (!specContent && !isEditing) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 text-center">
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <div className="text-white/70 text-[11px] mb-3">
          {hasAgentRun ? 'AI 尚未生成 Spec' : '等待 Spec 生成'}
        </div>
        <p className="text-white/60 text-[10px] max-w-[220px] leading-relaxed">
          {hasAgentRun
            ? 'AI 正在分析需求，Spec 将在 AI 完成需求分析后自动出现。如果 AI 已完成但未生成 Spec，请在对话中要求其创建 Spec 文档。'
            : 'Spec 由 AI 在 Spec-driven 场景下自动生成。AI 分析需求后会在此处显示 Spec 预览。您也可以点击下方按钮手动创建。'
          }
        </p>
        {activeTaskId && (
          <button
            onClick={handleEdit}
            className="mt-4 text-[10px] px-3 py-1 rounded-md bg-white/[0.06] border border-cp-border/30 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            创建 Spec
          </button>
        )}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-cp-border/30">
          <span className="text-[10px] text-white/80 uppercase tracking-wider">编辑 Spec</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCancel}
              className="text-[10px] px-2 py-0.5 rounded-md text-white/70 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="text-[10px] px-2 py-0.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="flex-1 w-full bg-transparent text-sm text-cp-text px-3 py-2 outline-none resize-none font-mono leading-relaxed"
          placeholder="用 Markdown 编写你的 Spec..."
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cp-border/30">
        <span className="text-[10px] text-white/80 uppercase tracking-wider">Spec</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleEdit}
            className="text-[10px] px-2 py-0.5 rounded-md text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            title="Edit spec"
          >
            编辑
          </button>
          {specContent && activeTaskId && specStatus === 'pending' && (
            <>
              <button
                onClick={handleApprove}
                className="text-[10px] px-2 py-0.5 rounded-md bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
              >
                批准
              </button>
              <button
                onClick={handleReject}
                className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
              >
                驳回
              </button>
            </>
          )}
          {specStatus === 'approved' && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-green-500/15 text-green-400">
              Spec 已批准
            </span>
          )}
          {specStatus === 'rejected' && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/15 text-red-400">
              Spec 已驳回
            </span>
          )}
        </div>
      </div>

      {/* Markdown content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="prose prose-sm max-w-none text-cp-text
          prose-headings:text-cp-text prose-headings:font-medium
          prose-p:text-cp-text/90 prose-p:leading-relaxed
          prose-code:text-cp-accent prose-code:bg-cp-text-dim/10 prose-code:px-1 prose-code:rounded
          prose-pre:bg-cp-editor prose-pre:border prose-pre:border-cp-border/20
          prose-li:text-cp-text/90 prose-li:marker:text-cp-text/60
          prose-a:text-cp-accent prose-a:no-underline hover:prose-a:underline
          prose-strong:text-cp-text
          prose-table:text-xs
          prose-th:text-cp-text/80 prose-th:border-cp-border/30
          prose-td:text-cp-text/80 prose-td:border-cp-border/20
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {specContent || ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
