// Quest Task List - left column showing all quest tasks

import { useState, useRef, useEffect } from 'react';
import { useQuestStore, type QuestTask } from '../../stores/quest-store';

const SCENARIO_ICONS: Record<string, string> = {
  spec: '\u2263',
  prototype: '\u25a3',
  tool: '\u2692',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-white/10',
  running: 'bg-blue-500',
  paused: 'bg-yellow-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
};

export function QuestTaskList() {
  const { tasks, activeTaskId, runningTaskIds, switchTask, deleteTask, createTask, updateTaskTitle } = useQuestStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleNewTask = async () => {
    await createTask('spec', 'local', 'auto');
  };

  const handleDelete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete === taskId) {
      await deleteTask(taskId);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(taskId);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const handleStartRename = (taskId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(taskId);
    setEditText(currentTitle);
  };

  const handleRenameConfirm = (taskId: string) => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== '') {
      updateTaskTitle(taskId, trimmed);
    }
    setEditingId(null);
    setEditText('');
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditText('');
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-cp-bg border-r border-cp-border/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cp-border/30">
        <span className="text-xs font-medium text-white/80 uppercase tracking-wider">Tasks</span>
        <button
          onClick={handleNewTask}
          className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          + New
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-white/50">
            No tasks yet
          </div>
        ) : (
          tasks.map((task: QuestTask) => {
            const isActive = task.id === activeTaskId;
            const isRunning = runningTaskIds.includes(task.id);
            const isEditing = editingId === task.id;

            return (
              <div
                key={task.id}
                onClick={() => !isEditing && switchTask(task.id)}
                className={`group px-3 py-2.5 cursor-pointer border-b border-cp-border/20 transition-colors ${
                  isActive
                    ? 'bg-white/[0.08] border-l-2 border-l-cp-accent'
                    : 'hover:bg-white/[0.04] border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* Scenario icon */}
                  <span className="text-xs text-white/60 mt-0.5 shrink-0">
                    {SCENARIO_ICONS[task.scenario] || '\u25cf'}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Title - inline edit or display */}
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameConfirm(task.id);
                          } else if (e.key === 'Escape') {
                            handleRenameCancel();
                          }
                        }}
                        onBlur={() => handleRenameConfirm(task.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-xs bg-black/30 border border-cp-accent/50 rounded px-1.5 py-0.5 text-cp-text outline-none"
                      />
                    ) : (
                      <p
                        className={`text-xs truncate ${isActive ? 'text-cp-text' : 'text-white/80'}`}
                        onDoubleClick={(e) => handleStartRename(task.id, task.title || 'Untitled', e)}
                      >
                        {task.title || 'Untitled'}
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-1.5 mt-1">
                      {/* Status dot */}
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[task.status] || 'bg-white/10'} ${
                        isRunning ? 'animate-pulse' : ''
                      }`} />
                      <span className="text-[10px] text-white/60 capitalize">{task.status}</span>
                      <span className="text-[10px] text-white/50">{formatTime(task.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {!isEditing && (
                    <div className="shrink-0 flex items-center gap-0.5">
                      {/* Rename button */}
                      <button
                        onClick={(e) => handleStartRename(task.id, task.title || 'Untitled', e)}
                        className="text-[10px] px-1 py-0.5 rounded text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                        title="重命名"
                      >
                        &#9998;
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDelete(task.id, e)}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${
                          confirmDelete === task.id
                            ? 'text-red-400 bg-red-500/10 opacity-100'
                            : 'text-white/50 hover:text-red-400 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {confirmDelete === task.id ? 'confirm?' : '\u00d7'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
