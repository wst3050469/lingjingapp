// Quest Conversation - middle column chat interface

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, type ChatMode } from '../../stores/chat-store';
import { useQuestStore, generateQuestMessageId, type QuestMessage } from '../../stores/quest-store';
import { useModelStore } from '../../stores/model-store';
import { useTodoStore } from '../../stores/todo-store';
import { useEditTrackerStore } from '../../stores/edit-tracker-store';
import { useFileAttachments } from '../../hooks/useFileAttachments';
import type { FileAttachment } from '../../hooks/useFileAttachments';
import { useContextSelector } from '../../hooks/useContextSelector';
import { useDragDropFiles } from '../../hooks/useDragDropFiles';
import { usePromptPolish } from '../../hooks/usePromptPolish';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { ContextSelector } from '../context/ContextSelector';
import { ContextChips } from '../context/ContextChips';
import { ChatMessageView } from '../chat/ChatMessage';
import { TodoTracker } from '../chat/TodoTracker';
import { FileEditTracker } from '../chat/FileEditTracker';
import { FileChangeSummary } from '../chat/FileChangeSummary';
import { ChatModeSelector } from '../chat/ChatModeSelector';
import { ModelSelector } from '../chat/ModelSelector';
import { InputToolbar } from '../chat/InputToolbar';
import { ContextMeter } from '../chat/ContextMeter';
import { useQuestDiffStore } from '../../stores/quest-diff-store';

const MODES: { value: ChatMode; label: string; tooltip: string }[] = [
  { value: 'ask', label: 'Ask', tooltip: '智能问答 - 回答问题、解释代码、审查优化' },
  { value: 'agent', label: 'Agent', tooltip: '智能体 - 自主执行代码修改和文件操作' },
  { value: 'experts', label: 'Experts', tooltip: '专家团模式 - 多专家协作完成复杂任务' },
];

export function QuestConversation() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    activeTaskId,
    messages,
    isStreaming,
    currentStreamText,
    askUserRequest,
    confirmRequest,
    cumulativeTokens,
    maxContextTokens,
    isCompacting,
    compactQuest,
  } = useQuestStore();

  const { currentModel } = useModelStore();
  const { chatMode, setChatMode } = useChatStore();

  const { attachments, images, documents, addFiles, addFileFromFile, removeAttachment, clearAttachments, triggerFileInput, totalSize } = useFileAttachments();
  const {
    showSelector,
    selectorType,
    searchQuery: mentionQuery,
    searchResults,
    recommendedFiles,
    selectedContexts,
    detectMention,
    handleTextChange,
    handleSelect,
    openViaButton,
    dismissSelector,
    setSelectorType,
    setSearchQuery,
    removeContext,
    clearContexts,
  } = useContextSelector('quest');

  const { isDragging, dragHandlers, pasteHandler } = useDragDropFiles('quest', {
    onImageAdd: addFileFromFile,
  });
  const { isPolishing, polish } = usePromptPolish();

  // Get active task info
  const activeTask = useQuestStore((s) => s.tasks.find((t) => t.id === s.activeTaskId));

  // 语音输入处理
  const { isRecording, toggleRecording } = useVoiceInput(useCallback((newText: string) => setText(newText), []));

  // On mount: if active task is paused (e.g. returning from editor), auto-resume it.
  // If isStreaming is stale, clear it.
  useEffect(() => {
    const store = useQuestStore.getState();
    const taskId = store.activeTaskId;

    if (store.isStreaming && !taskId) {
      console.log('[QuestConversation] Mount: resetting stale isStreaming');
      store.resetStreamText();
      store.setStreaming(false);
      store.setActiveRunId(null);
    }

    // Auto-resume paused task on mount (user just came back).
    // Use TWO checks:
    //   1. Task status is 'paused' (fast path - status_change event already processed)
    //   2. Task has messages but no active agent in main process (slow path - 
    //      status_change from stopOnSwitch not yet processed due to race condition)
    if (taskId) {
      const task = store.tasks.find(t => t.id === taskId);
      const shouldResumeBasedOnStatus = task?.status === 'paused' && !store.isStreaming;
      const hasHistory = store.messages.length > 0;

      if (shouldResumeBasedOnStatus) {
        console.log('[QuestConversation] Mount: auto-resuming paused task:', taskId);
        const runId = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        store.setStreaming(true);
        store.resetStreamText();
        store.addRunningTask(taskId);
        store.setActiveRunId(runId);
        store.setTaskStatus(taskId, 'running');
        window.electronAPI.quest.resume(taskId, undefined, runId).catch((err) => {
          console.error('[QuestConversation] Auto-resume failed:', err);
          store.setStreaming(false);
          store.setActiveRunId(null);
          store.removeRunningTask(taskId);
        });
      } else if (hasHistory && !store.isStreaming && (task?.status === 'running' || task?.status === 'idle')) {
        // Check if agent exists in main process - if not, task was stopped
        // by stopOnSwitch but status_change event hasn't arrived yet (race condition)
        window.electronAPI.quest.getAgentStatus(taskId).then((status) => {
          if (!status.hasActiveAgent && !store.isStreaming) {
            console.log('[QuestConversation] Mount: task has no active agent, auto-resuming from DB:', taskId);
            const runId = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
            store.setStreaming(true);
            store.resetStreamText();
            store.addRunningTask(taskId);
            store.setActiveRunId(runId);
            store.setTaskStatus(taskId, 'running');
            window.electronAPI.quest.resume(taskId, undefined, runId).catch((err) => {
              console.error('[QuestConversation] Auto-resume (fallback) failed:', err);
              store.setStreaming(false);
              store.setActiveRunId(null);
              store.removeRunningTask(taskId);
            });
          }
        }).catch(() => {});
      }
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamText]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [text]);

  const handleSend = useCallback(async () => {
    const hasText = !!text.trim();
    const hasAttachments = attachments.length > 0;
    if ((!hasText && !hasAttachments) || isStreaming || !activeTaskId) return;

    // Capture values before clearing
    const messageText = text;
    const contexts = selectedContexts;
    const currentAttachments = [...attachments];
    const currentImages = images;
    const currentDocuments = documents;

    // Clear input immediately - before any store operations
    setText('');
    if (textareaRef.current) {
      textareaRef.current.value = '';
      textareaRef.current.style.height = 'auto';
    }
    clearContexts();
    dismissSelector();
    clearAttachments();

    const store = useQuestStore.getState();

    // Build display content (text + attachment indicator)
    const displayContent = hasAttachments && !hasText
      ? `[Attachment${currentAttachments.length > 1 ? 's' : ''}]`
      : messageText;

    // Add user message
    store.addMessage({
      id: generateQuestMessageId(),
      role: 'user',
      content: displayContent,
      timestamp: Date.now(),
    });
    store.setStreaming(true);
    store.resetStreamText();
    store.addRunningTask(activeTaskId);

    // Generate run epoch ID to discriminate events from this run vs stale events
    const runId = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    store.setActiveRunId(runId);

    const scenario = activeTask?.scenario || 'spec';
    const runMode = activeTask?.runMode || 'local';
    const autoMode = activeTask?.autoMode || 'auto';

    // Prepare images for IPC (base64 payload)
    const imagePayload = currentImages.length > 0
      ? currentImages.map(img => {
          const m = img.dataUrl?.match(/^data:(image\/\w+);base64,(.+)$/);
          return m ? { data: m[2], mediaType: m[1] } : null;
        }).filter(Boolean) as Array<{ data: string; mediaType: string }>
      : undefined;

    // Prepare documents for IPC (text content payload)
    const documentPayload = currentDocuments
      .filter(d => d.parseStatus === 'success' && d.content)
      .map(d => ({ name: d.name, content: d.content!, ext: d.ext }));

    try {
      // Smart dispatch: if task was paused/interrupted (has history messages and
      // status is paused/idle/failed), use quest:resume to continue from where it
      // stopped. Otherwise start a fresh quest:run.
      // ALSO: if task status is 'running' but agent is not active (race condition
      // where stopOnSwitch events haven't been processed), use quest:resume.
      const taskStatus = activeTask?.status;
      const hasHistory = store.messages.length > 0;
      let shouldResume = hasHistory && (taskStatus === 'paused' || taskStatus === 'idle' || taskStatus === 'failed');

      // Fallback check: if status is 'running' but agent is gone (race condition)
      if (!shouldResume && hasHistory && taskStatus === 'running') {
        try {
          const agentStatus = await window.electronAPI.quest.getAgentStatus(activeTaskId);
          if (!agentStatus.hasActiveAgent) {
            console.log('[QuestConversation] handleSend: task status is running but no active agent, using resume');
            shouldResume = true;
          }
        } catch { /* ignore IPC error, fall through to quest:run */ }
      }

      if (shouldResume) {
        console.log('[QuestConversation] Resuming interrupted task:', { taskId: activeTaskId, taskStatus, msgCount: store.messages.length });
        await window.electronAPI.quest.resume(activeTaskId, messageText || undefined, runId);
      } else {
        await window.electronAPI.quest.run({
          taskId: activeTaskId,
          message: messageText || 'Please analyze this.',
          scenario,
          runMode,
          autoMode,
          chatMode,
          runId,
          images: imagePayload,
          documents: documentPayload.length > 0 ? documentPayload : undefined,
          contexts: contexts.map(ctx => ({
            id: ctx.id,
            type: ctx.type,
            label: ctx.label,
            path: ctx.path,
          })),
        } as any);
      }
    } catch (err) {
      store.addMessage({
        id: generateQuestMessageId(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Quest run failed'}`,
        timestamp: Date.now(),
      });
      store.setStreaming(false);
      store.setActiveRunId(null);
      if (activeTaskId) store.removeRunningTask(activeTaskId);
    }
  }, [text, attachments, images, documents, isStreaming, activeTaskId, activeTask, selectedContexts, clearContexts, dismissSelector, clearAttachments]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // If context selector is showing, let it handle keyboard events
    if (showSelector) return;
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = async () => {
    if (activeTaskId) {
      try {
        await window.electronAPI.quest.abort(activeTaskId);
      } catch { /* ignore */ }
    }
  };

  const handlePause = async () => {
    if (activeTaskId) {
      try {
        await window.electronAPI.quest.pause(activeTaskId);
      } catch { /* ignore */ }
    }
  };

  const handleResume = async () => {
    if (activeTaskId) {
      try {
        const store = useQuestStore.getState();
        store.setStreaming(true);
        store.resetStreamText();
        store.addRunningTask(activeTaskId);
        const runId = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        store.setActiveRunId(runId);
        await window.electronAPI.quest.resume(activeTaskId, undefined, runId);
      } catch { /* ignore */ }
    }
  };

  // Handle ask-user reply
  const handleAskReply = async (answer: string) => {
    if (!askUserRequest) return;
    try {
      await window.electronAPI.quest.replyAskUser(askUserRequest.requestId, answer);
    } catch { /* ignore */ }
    useQuestStore.getState().setAskUserRequest(null);
  };

  // Handle confirmation reply
  const handleConfirmReply = async (approved: boolean, feedback?: string) => {
    if (!confirmRequest) return;
    try {
      await window.electronAPI.quest.confirmReply(confirmRequest.requestId, approved, feedback);
    } catch { /* ignore */ }
    useQuestStore.getState().setConfirmRequest(null);
  };

  // Map QuestMessage to ChatMessage format for ChatMessageView
  const mapToViewMessage = (msg: QuestMessage) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'tool',
    content: msg.content,
    toolCalls: msg.toolCalls,
    timestamp: msg.timestamp,
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cp-border/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/80">
            {activeTask?.title || 'Quest'}
          </span>
          {activeTask?.status === 'running' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
              running
            </span>
          )}
          {activeTask?.status === 'paused' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
              paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isStreaming && (
            <button
              onClick={handlePause}
              className="text-[10px] px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
            >
              Pause
            </button>
          )}
          {(activeTask?.status === 'paused' || activeTask?.status === 'idle') && !isStreaming && (
            <button
              onClick={handleResume}
              className="text-[10px] px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
            >
              Resume
            </button>
          )}
        </div>
      </div>

      {/* Model selector (compact) */}
      <div className="shrink-0 border-b border-cp-border/30 px-2 py-1">
        <ModelSelector />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Task progress and file changes */}
          <div className="space-y-2 sticky top-0 z-10 bg-cp-bg pb-4">
            <TodoTracker />
            <QuestFileChangeSummary />
          </div>

          {messages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="w-10 h-10 text-white/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <p className="text-white/60 text-xs">发送消息开始与 AI 对话</p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageView key={msg.id} message={mapToViewMessage(msg)} />
            ))
          )}

          {/* Streaming response */}
          {isStreaming && currentStreamText && (
            <ChatMessageView
              message={{
                id: 'quest-streaming',
                role: 'assistant',
                content: currentStreamText,
                timestamp: Date.now(),
              }}
            />
          )}

          {/* Thinking indicator */}
          {isStreaming && !currentStreamText && (
            <div className="flex items-center gap-2 text-white/80 text-sm py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>Thinking...</span>
            </div>
          )}

          {/* Ask user inline prompt */}
          {askUserRequest && (
            <AskUserPrompt
              question={askUserRequest.question}
              onReply={handleAskReply}
            />
          )}

          {/* Confirmation banner */}
          {confirmRequest && (
            <ConfirmBanner
              request={confirmRequest}
              onReply={handleConfirmReply}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Context meter + compact */}
      <div className="max-w-3xl mx-auto px-2 w-full">
        <ContextMeter
          cumulativeTokens={cumulativeTokens}
          maxContextTokens={maxContextTokens}
          isCompacting={isCompacting}
          canCompact={messages.length >= 4 && cumulativeTokens >= 2000 && !isStreaming && !isCompacting}
          onCompact={compactQuest}
        />
      </div>

      {/* Bottom input */}
      <div className="border-t border-cp-border/30 bg-cp-bg px-2 py-2">
        <div className="max-w-3xl mx-auto">
          <div
            className={`bg-cp-panel border rounded-xl focus-within:border-white/30 transition-colors overflow-hidden relative ${
              isDragging ? 'border-blue-500/60 bg-blue-500/5' : 'border-cp-border/60'
            }`}
            {...dragHandlers}
          >
            {/* Drag overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-500/10 rounded-xl pointer-events-none">
                <span className="text-sm text-blue-400">Drop files here</span>
              </div>
            )}

            {/* Context chips - 显示已添加的附件和上下文 */}
            {(attachments.length > 0 || selectedContexts.length > 0) && (
              <div className="pt-1.5">
                <ContextChips
                  files={attachments.map(a => a.path)}
                  contexts={selectedContexts}
                  onRemoveFile={(path) => {
                    const a = attachments.find(x => x.path === path);
                    if (a) removeAttachment(a.id);
                  }}
                  onRemoveContext={removeContext}
                />
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                // Detect @ mention via new context selector
                const cursorPos = e.target.selectionStart;
                handleTextChange(e.target.value, cursorPos);
              }}
              onKeyDown={handleKeyDown}
              onPaste={pasteHandler}
              onClick={() => {
                // Detect @ mention on click
                if (textareaRef.current) {
                  const cursorPos = textareaRef.current.selectionStart;
                  handleTextChange(text, cursorPos);
                }
              }}
              placeholder={chatMode === 'ask' ? '提问或粘贴代码... (Enter 发送, @ 添加上下文)' : '发送消息... (Enter 发送, @ 添加上下文)'}
              rows={1}
              className="w-full bg-transparent px-3 pt-2 pb-1 text-sm text-cp-text outline-none resize-none min-h-[40px] placeholder:text-cp-text-dim/40 leading-relaxed"
            />

            {/* Context Selector */}
            {showSelector && (
              <ContextSelector
                show={showSelector}
                scope="quest"
                onDismiss={dismissSelector}
                onSelect={(item) => handleSelect(item, text, setText)}
                searchQuery={mentionQuery}
                onQueryChange={setSearchQuery}
              />
            )}

            {/* Bottom control bar */}
            <div className="px-2 pb-1.5 flex items-center gap-1.5">
              {/* Mode selector */}
              <ChatModeSelector />
              
              {/* Spacer */}
              <div className="flex-1" />
              
              {/* Input toolbar */}
              <InputToolbar
                onImage={triggerFileInput}
                onVoice={() => toggleRecording(text)}
                onPolish={async () => {
                  if (text.trim()) {
                    const polished = await polish(text);
                    setText(polished);
                  }
                }}
                onSend={() => { if (text.trim() || attachments.length > 0) handleSend(); }}
                onStop={handleStop}
                isStreaming={isStreaming}
                isRecording={isRecording}
                isPolishing={isPolishing}
                canSend={!!text.trim() || attachments.length > 0}
              />
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx"
            multiple
            className="hidden"
            onChange={addFiles}
          />
        </div>
      </div>
    </div>
  );
}

// --- Inline Sub-Components ---

function AskUserPrompt({ question, onReply }: { question: string; onReply: (answer: string) => void }) {
  const [answer, setAnswer] = useState('');

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
      <p className="text-sm text-blue-300 mb-2">{question}</p>
      <div className="flex gap-2">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && answer.trim()) { onReply(answer); setAnswer(''); } }}
          placeholder="Type your answer..."
          className="flex-1 bg-cp-panel border border-cp-border/40 rounded-md px-3 py-1.5 text-sm text-cp-text outline-none focus:border-blue-500/50 placeholder:text-cp-text-dim/50"
          autoFocus
        />
        <button
          onClick={() => { if (answer.trim()) { onReply(answer); setAnswer(''); } }}
          className="px-3 py-1.5 rounded-md bg-blue-500/20 text-blue-300 text-xs hover:bg-blue-500/30 transition-colors"
        >
          Reply
        </button>
      </div>
    </div>
  );
}

function ConfirmBanner({
  request,
  onReply,
}: {
  request: NonNullable<ReturnType<typeof useQuestStore.getState>['confirmRequest']>;
  onReply: (approved: boolean, feedback?: string) => void;
}) {
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-xs text-yellow-300 font-medium mb-1">
            {request.type === 'bash' ? 'Command execution' : request.type === 'plan' ? 'Plan approval' : 'Tool execution'}
          </p>
          <p className="text-sm text-cp-text font-mono bg-black/20 rounded px-2 py-1 mb-2">
            {request.command || request.toolName}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onReply(true)}
          className="px-3 py-1 rounded-md bg-green-500/20 text-green-300 text-xs hover:bg-green-500/30 transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => onReply(false)}
          className="px-3 py-1 rounded-md bg-red-500/20 text-red-300 text-xs hover:bg-red-500/30 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// Quest-specific file change summary using useQuestDiffStore
function QuestFileChangeSummary() {
  const { fileChanges, acceptFile, rejectFile, acceptAll, rejectAll } = useQuestDiffStore();
  const files = Object.values(fileChanges);
  const [collapsed, setCollapsed] = useState(true);
  const [countOnAppear, setCountOnAppear] = useState(0);
  const [fileChangeBehavior, setFileChangeBehavior] = useState<string>('ask');

  // Load file change behavior config on mount
  useEffect(() => {
    window.electronAPI.config.get().then((c: any) => {
      const behavior = c?.quest?.fileChangeBehavior ?? 'ask';
      setFileChangeBehavior(behavior);
    }).catch(() => {});
  }, []);

  // Listen for real-time fileChangeBehavior changes from settings panel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.behavior) {
        setFileChangeBehavior(detail.behavior);
      }
    };
    window.addEventListener('quest:file-behavior-changed', handler);
    return () => window.removeEventListener('quest:file-behavior-changed', handler);
  }, []);

  // Auto-collapse when new files appear
  useEffect(() => {
    if (files.length > 0 && files.length !== countOnAppear) {
      setCollapsed(true);
      setCountOnAppear(files.length);
    }
  }, [files.length, countOnAppear]);

  // Auto-process pending files based on config (独立逻辑，不依赖 countOnAppear)
  // 修复竞态条件：fileChangeBehavior 通过异步 IPC 加载，到达前 countOnAppear 已锁定
  useEffect(() => {
    if (fileChangeBehavior === 'ask') return;

    const hasPending = files.some((f) => f && f.status === 'pending');
    if (hasPending) {
      if (fileChangeBehavior === 'auto-accept') {
        acceptAll();
      } else if (fileChangeBehavior === 'auto-reject') {
        rejectAll();
      }
    }
  }, [files, fileChangeBehavior, acceptAll, rejectAll]);

  if (files.length === 0) return null;

  const pendingCount = files.filter((f) => f && f.status === 'pending').length;

  return (
    <div className="bg-white/[0.02] border border-cp-border/40 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-xs text-white/80 font-medium hover:text-white transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {collapsed
            ? <span>已折叠，{files.length} 项变更文件</span>
            : <span>{files.length} 变更文件 {pendingCount > 0 && <span className="text-yellow-400 ml-1">({pendingCount} 待审查)</span>}</span>
          }
        </button>
        {collapsed ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); acceptAll(); }}
              className="text-[10px] px-2 py-0.5 rounded-md bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
              title="全部接受"
            >
              全部接受
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); rejectAll(); }}
              className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
              title="全部驳回"
            >
              全部驳回
            </button>
            <button
              onClick={() => setCollapsed(false)}
              className="text-[11px] text-white/70 hover:text-white transition-colors flex items-center gap-1"
              title="展开查看"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              展开
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={acceptAll}
              className="text-[10px] px-2 py-0.5 rounded-md bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
            >
              全部接受
            </button>
            <button
              onClick={rejectAll}
              className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
            >
              全部驳回
            </button>
          </div>
        )}
      </div>

      {/* File list (collapsible) */}
      {!collapsed && (
        <div className="border-t border-cp-border/30 divide-y divide-cp-border/20">
          {files.map((file) => {
            const fileName = file.filePath.split(/[\\\/]/).pop() || file.filePath;
            const statusColor = file.status === 'pending' ? 'text-yellow-400' :
                               file.status === 'accepted' ? 'text-green-400' : 'text-red-400';
            return (
              <div
                key={file.filePath}
                className="group flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.02] text-xs"
              >
                <span className="text-[10px] font-mono text-white/60 w-4 shrink-0">{file.isNewFile ? 'A' : 'M'}</span>
                <span className="text-white/80 font-mono truncate flex-1" title={file.filePath}>
                  {fileName}
                </span>
                <span className={`text-[10px] font-medium ${statusColor} shrink-0`}>+{file.addedLines || 0} -{file.removedLines || 0}</span>
                {file.status === 'pending' ? (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); acceptFile(file.filePath); }}
                      className="w-5 h-5 flex items-center justify-center rounded text-green-400 hover:bg-green-500/15 text-[10px]"
                      title="接受"
                    >
                      &#10003;
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); rejectFile(file.filePath); }}
                      className="w-5 h-5 flex items-center justify-center rounded text-red-400 hover:bg-red-500/15 text-[10px]"
                      title="驳回"
                    >
                      &#10005;
                    </button>
                  </div>
                ) : (
                  <span className={`text-[9px] ${statusColor} capitalize shrink-0`}>{file.status === 'accepted' ? '已接受' : '已驳回'}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

