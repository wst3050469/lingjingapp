import { useEffect, useState, useRef } from 'react';
import { useChatStore, type ConversationSummary } from '../../stores/chat-store';
import { useAuthStore } from '../../stores/auth-store';
import { useUIStore } from '../../stores/ui-store';

export function ConversationSidebar() {
  const { user } = useAuthStore();
  const { conversations, currentConversationId, createNewConversation, loadConversationList, loadConversation,
    deleteConversation, renameConversation } = useChatStore();
  const { setShowSettingsModal } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadConversationList(user.id);
    }
  }, [user?.id]);

  const filtered = searchQuery.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  return (
    <div className="w-[260px] h-full bg-cp-sidebar flex flex-col border-r border-cp-border shrink-0">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <span className="text-cp-text font-semibold text-lg">{'\u7075\u5883'}</span>
        <button
          onClick={createNewConversation}
          className="text-cp-text-dim hover:text-cp-text text-xl px-2 transition-colors"
          title="新建对话 (Ctrl+N)"
        >
          +
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索对话..."
          className="w-full bg-white/5 border border-cp-border/50 rounded-lg px-3 py-1.5 text-xs text-cp-text
            outline-none focus:border-cp-accent/50 placeholder:text-cp-text-dim/40 transition-colors"
        />
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {filtered.length === 0 && searchQuery && (
          <p className="text-cp-text-dim text-xs text-center mt-4 px-2">未找到匹配的对话</p>
        )}
        {filtered.length === 0 && !searchQuery && (
          <p className="text-cp-text-dim text-xs text-center mt-4 px-2">还没有对话记录</p>
        )}
        {filtered.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            active={conv.id === currentConversationId}
            onClick={() => loadConversation(conv.id)}
            onDelete={() => deleteConversation(conv.id)}
            onRename={(title) => renameConversation(conv.id, title)}
          />
        ))}
      </div>

      {/* Bottom: user info + settings */}
      <div className="p-3 border-t border-cp-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-cp-accent/30 flex items-center justify-center text-xs text-cp-accent shrink-0">
            {user?.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <span className="text-sm text-cp-text-dim truncate">{user?.username}</span>
        </div>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="text-cp-text-dim hover:text-cp-text text-lg transition-colors"
          title="设置 (Ctrl+,)"
        >
          &#9881;
        </button>
      </div>
    </div>
  );
}

function ConversationItem({ conversation, active, onClick, onDelete, onRename }: {
  conversation: ConversationSummary;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleRename = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  if (isEditing) {
    return (
      <div className="px-1 py-1">
        <input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') { setIsEditing(false); setEditTitle(conversation.title); }
          }}
          onBlur={handleRename}
          className="w-full bg-cp-bg border border-cp-accent/50 rounded px-2 py-1.5 text-sm text-cp-text outline-none"
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`group w-full flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer
        ${active ? 'bg-cp-surface text-cp-text' : 'text-cp-text-dim hover:bg-white/5 hover:text-cp-text'}`}
    >
      <span className="flex-1 truncate">{conversation.title}</span>
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); setEditTitle(conversation.title); setIsEditing(true); }}
          className="text-cp-text-dim/50 hover:text-cp-text p-0.5"
          title="重命名"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          className={`p-0.5 ${confirmDelete ? 'text-red-400' : 'text-cp-text-dim/50 hover:text-red-400'}`}
          title={confirmDelete ? '点击确认删除' : '删除'}
        >
          {confirmDelete ? (
            <span className="text-[10px]">确认?</span>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
