import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, generateMessageId, loadSessionSnapshot, clearSessionSnapshot, type ChatMessage } from '../../stores/chat-store';
import { useAuthStore } from '../../stores/auth-store';
import { useUIStore } from '../../stores/ui-store';
import { useDiffReviewStore } from '../../stores/diff-review-store';
import { ChatMessageView } from '../chat/ChatMessage';
import { ModelSelector } from '../chat/ModelSelector';
import { ChatModeSelector } from '../chat/ChatModeSelector';
import { ContextChips } from '../chat/ContextChips';
import { InputToolbar } from '../chat/InputToolbar';
import { RecommendationCards } from '../chat/RecommendationCards';
import { FileEditTracker } from '../chat/FileEditTracker';
import { FileChangeSummary } from '../chat/FileChangeSummary';
import { TodoTracker } from '../chat/TodoTracker';
import { CodeContextPanel } from '../chat/CodeContextPanel';
import { ContextMeter } from '../chat/ContextMeter';
import { useFileAttachments } from '../../hooks/useFileAttachments';
import type { FileAttachment } from '../../hooks/useFileAttachments';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { usePromptPolish } from '../../hooks/usePromptPolish';

export function ChatSidebar() {
  const { messages, isStreaming, currentStreamText, askUserRequest, currentConversationId,
    conversations, createNewConversation, loadConversationList, loadConversation,
    deleteConversation, renameConversation,
    chatMode, lastUsage, recommendations, codeContext,
    cumulativeTokens, maxContextTokens, isCompacting, compactChat } = useChatStore();
  const { user } = useAuthStore();
  const { setShowSettingsModal } = useUIStore();
  const { isReviewActive } = useDiffReviewStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showConvList, setShowConvList] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sessionSnapshot, setSessionSnapshot] = useState(() => loadSessionSnapshot());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Shared hooks for attachments & input enhancements
  const { attachments, images, documents, addFiles, addFileFromFile, removeAttachment, clearAttachments, fileInputRef, triggerFileInput, totalSize } = useFileAttachments();
  const { isRecording, toggleRecording } = useVoiceInput(useCallback((text: string) => setInputText(text), []));
  const { isPolishing, polish } = usePromptPolish();

  // Ensure conversation ID exists
  useEffect(() => {
    if (!currentConversationId) {
      createNewConversation();
    }
  }, [currentConversationId]);

  // Load conversation list
  useEffect(() => {
    if (user?.id) {
      loadConversationList(user.id);
    }
  }, [user?.id]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamText]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputText]);

  // Handle screenshot paste (clipboardData.files is empty for screenshots — must read .items)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          addFileFromFile(file);
        }
      }
    }
  }, [addFileFromFile]);

  const handleContinueSession = async () => {
    if (!sessionSnapshot) return;
    const store = useChatStore.getState();

    if (sessionSnapshot.conversationId) {
      try {
        await store.loadConversation(sessionSnapshot.conversationId);
      } catch {
        const fallback = sessionSnapshot.conversationSummary
          ? `[Continuing from previous session: ${sessionSnapshot.conversationTitle}]\nSummary: ${sessionSnapshot.conversationSummary}`
          : `[Continuing from previous session: ${sessionSnapshot.conversationTitle}]\nThis session had ${sessionSnapshot.messageCount} messages in ${sessionSnapshot.chatMode} mode.`;
        store.addMessage({ id: generateMessageId(), role: 'user', content: fallback, timestamp: Date.now() });
      }
    } else {
      const fallback = sessionSnapshot.conversationSummary
        ? `[Continuing from previous session: ${sessionSnapshot.conversationTitle}]\nSummary: ${sessionSnapshot.conversationSummary}`
        : `[Continuing from previous session: ${sessionSnapshot.conversationTitle}]\nThis session had ${sessionSnapshot.messageCount} messages in ${sessionSnapshot.chatMode} mode.`;
      store.addMessage({ id: generateMessageId(), role: 'user', content: fallback, timestamp: Date.now() });
    }

    if (sessionSnapshot.chatMode) {
      store.setChatMode(sessionSnapshot.chatMode);
    }
    clearSessionSnapshot();
    setSessionSnapshot(null);
  };

  const handleDismissSession = () => {
    clearSessionSnapshot();
    setSessionSnapshot(null);
  };

  const handleSend = async (text: string) => {
    if ((!text.trim() && attachments.length === 0) || isStreaming) return;

    // Compose prompt with context
    let finalPrompt = text;

    // Append code context if available
    if (codeContext) {
      const fileName = codeContext.filePath.split(/[/\\]/).pop() || codeContext.filePath;
      const lineInfo = codeContext.startLine
        ? codeContext.endLine && codeContext.endLine !== codeContext.startLine
          ? ` (L${codeContext.startLine}-${codeContext.endLine})`
          : ` (L${codeContext.startLine})`
        : '';
      finalPrompt = `[Code from ${fileName}${lineInfo}]\n\`\`\`${codeContext.language}\n${codeContext.code}\n\`\`\`\n\n${finalPrompt}`;
    }

    if (images.length > 0) {
      finalPrompt = `[${images.length} image(s) attached]\n\n${finalPrompt}`;
    }
    const currentDocuments = documents.filter(d => d.parseStatus === 'success' && d.content);
    if (currentDocuments.length > 0) {
      finalPrompt = `[${currentDocuments.length} document(s) attached]\n\n${finalPrompt}`;
    }

    const userMsg: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: finalPrompt,
      attachments: attachments.length > 0
        ? {
            images: images.length > 0 ? images.filter(img => img.dataUrl).map(img => ({ name: img.name, dataUrl: img.dataUrl! })) : undefined,
            files: currentDocuments.map(d => d.name),
            documents: currentDocuments.length > 0 ? currentDocuments : undefined,
          }
        : undefined,
      timestamp: Date.now(),
    };
    useChatStore.getState().addMessage(userMsg);
    useChatStore.getState().setStreaming(true);
    useChatStore.getState().resetStreamText();
    useChatStore.getState().setLastUsage(null);
    useChatStore.getState().setCodeContext(null);
    setInputText('');
    clearAttachments();
    setShowConvList(false);
    try {
      // Inject conversation summary if available (for LLM context, not shown in UI)
      let agentPrompt = finalPrompt;
      const { conversationSummary } = useChatStore.getState();
      if (conversationSummary) {
        agentPrompt = `[Previous conversation summary]\n${conversationSummary}\n\n[Current message]\n${finalPrompt}`;
        useChatStore.getState().setConversationSummary(null);
      }
      const convId = useChatStore.getState().currentConversationId;
      // Prepare images for IPC (extract base64 from dataUrl)
      const imagePayload = images.length > 0
        ? images.map(img => {
            const m = img.dataUrl?.match(/^data:(image\/\w+);base64,(.+)$/);
            return m ? { data: m[2], mediaType: m[1] } : null;
          }).filter(Boolean) as Array<{ data: string; mediaType: string }>
        : undefined;

      const documentPayload = documents
        .filter(d => d.parseStatus === 'success' && d.content)
        .map(d => ({ name: d.name, content: d.content!, ext: d.ext }));

      console.log('[ChatSidebar] Sending agent.run:', { mode: chatMode, conversationId: convId, messageLength: agentPrompt.length, images: imagePayload?.length || 0, documents: documentPayload.length });
      await window.electronAPI.agent.run(agentPrompt, { mode: chatMode, conversationId: convId || undefined, images: imagePayload, documents: documentPayload.length > 0 ? documentPayload : undefined, conversationMessages: messages });
    } catch (err) {
      console.error('Agent run failed:', err);
    } finally {
      // Always reset streaming state — safety net in case 'done' event is missed
      useChatStore.getState().setStreaming(false);
    }
  };

  const handleStop = async () => {
    try { await window.electronAPI.agent.abort(); } catch { /* ignore */ }
  };

  const handleAskUserReply = async (answer: string) => {
    if (!askUserRequest) return;
    await window.electronAPI.agent.replyAskUser(askUserRequest.requestId, answer);
    useChatStore.getState().setAskUserRequest(null);
  };

  const handlePolish = async () => {
    const enhanced = await polish(inputText);
    setInputText(enhanced);
    textareaRef.current?.focus();
  };

  const filtered = searchQuery.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-cp-border shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-cp-text-dim font-medium">AI 对话</span>
        <button
          onClick={createNewConversation}
          className="text-cp-text-dim/50 hover:text-cp-text text-lg px-1 transition-colors"
          title="新建对话 (Ctrl+N)"
        >
          +
        </button>
      </div>

      {/* Collapsible conversation list */}
      <div className="shrink-0 border-b border-cp-border">
        <button
          onClick={() => setShowConvList(!showConvList)}
          className="w-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] text-cp-text-dim hover:text-cp-text transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${showConvList ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          对话记录 ({conversations.length})
        </button>

        {showConvList && (
          <div className="px-2 pb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索对话..."
              className="w-full bg-cp-bg border border-cp-border/50 rounded px-2 py-1 text-[11px] text-cp-text
                outline-none focus:border-cp-accent/50 placeholder:text-cp-text-dim/40 mb-1.5"
            />
            <div className="max-h-[150px] overflow-y-auto space-y-0.5">
              {filtered.length === 0 && (
                <p className="text-cp-text-dim/40 text-[10px] text-center py-2">
                  {searchQuery ? '未找到匹配的对话' : '还没有对话记录'}
                </p>
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
          </div>
        )}
      </div>

      {/* Model selector (compact) */}
      <div className="shrink-0 border-b border-cp-border px-1">
        <ModelSelector />
      </div>

      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 space-y-3">

          {sessionSnapshot && (
            <div className="bg-white/[0.04] border border-cp-accent/30 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">↩</span>
                  <div>
                    <p className="text-xs text-cp-text font-medium">继续上次会话</p>
                    <p className="text-[10px] text-cp-text-dim/60 mt-0.5">
                      {sessionSnapshot.conversationTitle} · {sessionSnapshot.messageCount} 条消息
                    </p>
                  </div>
                </div>
                <button onClick={handleDismissSession} className="text-cp-text-dim/40 hover:text-cp-text text-sm" title="关闭">×</button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleContinueSession}
                  className="text-[10px] px-2 py-1 rounded bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
                >
                  恢复上下文
                </button>
                {sessionSnapshot.contextFiles.length > 0 && (
                  <span className="text-[10px] text-cp-text-dim/50">
                    {sessionSnapshot.contextFiles.length} 个文件引用
                  </span>
                )}
              </div>
            </div>
          )}
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-8">
              {chatMode === 'ask' ? (
                <>
                  <p className="text-cp-text-dim/40 text-xs">智能问答模式</p>
                  <p className="text-cp-text-dim/30 text-[10px] mt-1">提问、解释代码、审查优化、修复问题</p>
                  <div className="mt-3 space-y-1 text-[10px] text-cp-text-dim/25">
                    <p><kbd className="px-1 py-0.5 bg-cp-border/50 rounded text-cp-text-dim/40">Ctrl+Shift+L</kbd> 选中代码发送到聊天</p>
                    <p><kbd className="px-1 py-0.5 bg-cp-border/50 rounded text-cp-text-dim/40">Ctrl+L</kbd> 聚焦聊天输入框</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-cp-text-dim/40 text-xs">开始一段新对话</p>
                  <p className="text-cp-text-dim/30 text-[10px] mt-1">输入消息开始与 AI 对话</p>
                </>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessageView key={msg.id} message={msg} />
          ))}

          {/* Streaming response */}
          {isStreaming && currentStreamText && (
            <ChatMessageView
              message={{ id: 'streaming', role: 'assistant', content: currentStreamText, timestamp: Date.now() }}
            />
          )}

          {/* Thinking indicator */}
          {isStreaming && !currentStreamText && (
            <div className="flex items-center gap-2 text-cp-text-dim text-xs py-1">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cp-text-dim animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-cp-text-dim animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-cp-text-dim animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>思考中...</span>
            </div>
          )}

          {/* File edit tracker */}
          {isStreaming && <FileEditTracker />}

          {/* Todo tracker */}
          <TodoTracker />

          {/* Diff review: file change summary after agent completes */}
          {!isStreaming && isReviewActive && <FileChangeSummary />}

          {/* Ask user inline */}
          {askUserRequest && (
            <div className="bg-cp-accent/10 border border-cp-accent/30 rounded-lg p-3">
              <p className="text-xs text-cp-info">{askUserRequest.question}</p>
            </div>
          )}

          {/* Context meter + compact chat */}
          {!isStreaming && messages.length > 0 && (
            <ContextMeter
              cumulativeTokens={cumulativeTokens}
              maxContextTokens={maxContextTokens}
              isCompacting={isCompacting}
              canCompact={messages.length >= 4 && cumulativeTokens >= 2000 && !isStreaming && !isCompacting}
              onCompact={compactChat}
            />
          )}

          {/* Recommendation cards */}
          {!isStreaming && recommendations.length > 0 && messages.length > 0 && (
            <RecommendationCards
              recommendations={recommendations}
              onSelect={(text) => {
                setInputText(text);
                textareaRef.current?.focus();
              }}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-cp-border p-2">
        {askUserRequest ? (
          <AskUserCompact onReply={handleAskUserReply} />
        ) : (
          <div className="bg-cp-sidebar border border-cp-border rounded-lg overflow-hidden focus-within:border-cp-accent/50 transition-colors">
            {/* Code context panel */}
            {codeContext && (
              <CodeContextPanel
                context={codeContext}
                onRemove={() => useChatStore.getState().setCodeContext(null)}
              />
            )}

            {/* Context chips */}
            {(attachments.length > 0) && (
              <div className="pt-1.5">
                <ContextChips
                  attachments={attachments}
                  onRemoveAttachment={removeAttachment}
                />
              </div>
            )}

            <textarea
              ref={textareaRef}
              data-chat-input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (inputText.trim() && !isStreaming) {
                    handleSend(inputText.trim());
                  }
                }
              }}
              placeholder={isStreaming
                ? '等待回复中...'
                : codeContext
                  ? '对这段代码提问... (Enter 发送)'
                  : chatMode === 'ask'
                    ? '提问或粘贴代码... (Enter 发送)'
                    : '发送消息... (Enter 发送)'
              }
              disabled={isStreaming}
              rows={1}
              onPaste={handlePaste}
              className="w-full bg-transparent px-3 pt-2 pb-1 text-xs text-cp-text
                outline-none resize-none disabled:opacity-50 min-h-[32px] placeholder:text-cp-text-dim/40"
            />

            {/* Mode selector + toolbar */}
            <div className="px-2 pb-1.5 flex items-center gap-1.5">
              <ChatModeSelector />
              <div className="flex-1" />
              <InputToolbar
                onFile={triggerFileInput}
                onVoice={() => toggleRecording(inputText)}
                onPolish={handlePolish}
                onSend={() => { if (inputText.trim() || attachments.length > 0) handleSend(inputText.trim()); }}
                onStop={handleStop}
                isStreaming={isStreaming}
                isRecording={isRecording}
                isPolishing={isPolishing}
                canSend={!!inputText.trim() || attachments.length > 0}
              />
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx"
        multiple
        className="hidden"
        onChange={addFiles}
      />

      {/* Bottom: user info */}
      <div className="shrink-0 px-3 py-2 border-t border-cp-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-full bg-cp-accent/30 flex items-center justify-center text-[9px] text-cp-accent shrink-0">
            {user?.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <span className="text-[11px] text-cp-text-dim truncate">{user?.username}</span>
        </div>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="text-cp-text-dim/50 hover:text-cp-text text-sm transition-colors"
          title="设置"
        >
          &#9881;
        </button>
      </div>
    </div>
  );
}

function AskUserCompact({ onReply }: { onReply: (answer: string) => void }) {
  const [answer, setAnswer] = useState('');
  return (
    <div className="bg-cp-sidebar border border-cp-accent/50 rounded-lg overflow-hidden">
      <div className="px-2 pt-1.5">
        <span className="text-[9px] text-cp-accent/70 uppercase tracking-wider">等待回复</span>
      </div>
      <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-0.5">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && answer.trim()) {
              onReply(answer.trim());
              setAnswer('');
            }
          }}
          className="flex-1 bg-transparent px-1 py-1 text-xs text-cp-text outline-none placeholder:text-cp-text-dim/40"
          placeholder="输入回答..."
          autoFocus
        />
        <button
          onClick={() => { if (answer.trim()) { onReply(answer.trim()); setAnswer(''); } }}
          disabled={!answer.trim()}
          className="px-2 py-1 bg-cp-accent text-cp-text rounded text-[10px]
            hover:bg-cp-accent/80 disabled:opacity-30 transition-colors"
        >
          回复
        </button>
      </div>
    </div>
  );
}

function ConversationItem({ conversation, active, onClick, onDelete, onRename }: {
  conversation: { id: string; title: string };
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
      <div className="px-2 py-1">
        <input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') { setIsEditing(false); setEditTitle(conversation.title); }
          }}
          onBlur={handleRename}
          className="w-full bg-cp-bg border border-cp-accent/50 rounded px-1.5 py-1 text-[11px] text-cp-text outline-none"
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`group w-full flex items-center gap-1 px-2 py-1.5 rounded text-[11px] transition-colors cursor-pointer ${
        active ? 'bg-cp-surface text-cp-text' : 'text-cp-text-dim hover:bg-white/5 hover:text-cp-text'
      }`}
    >
      <span className="flex-1 truncate">{conversation.title}</span>
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Rename button */}
        <button
          onClick={(e) => { e.stopPropagation(); setEditTitle(conversation.title); setIsEditing(true); }}
          className="text-cp-text-dim/50 hover:text-cp-text px-0.5"
          title="重命名"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        </button>
        {/* Delete button */}
        <button
          onClick={handleDelete}
          className={`px-0.5 ${confirmDelete ? 'text-red-400' : 'text-cp-text-dim/50 hover:text-red-400'}`}
          title={confirmDelete ? '点击确认删除' : '删除'}
        >
          {confirmDelete ? (
            <span className="text-[9px]">确认?</span>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
