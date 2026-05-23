import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, generateMessageId, type ChatMessage } from '../../stores/chat-store';
import { useAuthStore } from '../../stores/auth-store';
import { useUIStore } from '../../stores/ui-store';
import { useDiffReviewStore } from '../../stores/diff-review-store';
import { useConfirmationStore } from '../../stores/confirmation-store';
import { useExpertsStore } from '../../stores/experts-store';
import { useQuestStore } from '../../stores/quest-store';
import { ChatMessageView } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatHeader } from './ChatHeader';
import { ChatModeSelector } from './ChatModeSelector';
import { ExpertStatusPanel } from './ExpertStatusPanel';
import { ConfirmationBanner } from './ConfirmationBanner';
import { AcceptRejectBar } from './AcceptRejectBar';
import { FileEditTracker } from './FileEditTracker';
import { FileChangeSummary } from './FileChangeSummary';
import { TodoTracker } from './TodoTracker';
import { ContextMeter } from './ContextMeter';
import { RecommendationCards } from './RecommendationCards';
import { useFileAttachments } from '../../hooks/useFileAttachments';
import type { FileAttachment } from '../../hooks/useFileAttachments';
import { usePromptPolish } from '../../hooks/usePromptPolish';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { QuestSpecTab } from '../quest/QuestSpecTab';
import { QuestChangedFilesTab } from '../quest/QuestChangedFilesTab';
import { QuestPreviewTab } from '../quest/QuestPreviewTab';

interface ChatPanelProps {
  compact?: boolean;
}

export function ChatPanel({ compact = false }: ChatPanelProps) {
  const {
    messages, isStreaming, currentStreamText, askUserRequest,
    currentConversationId, chatMode, recommendations, codeContext,
    cumulativeTokens, maxContextTokens, isCompacting, compactChat,
    createNewConversation, addMessage, setStreaming, resetStreamText,
    setLastUsage, setCodeContext, setAskUserRequest, setConversationSummary,
  } = useChatStore();
  const { user } = useAuthStore();
  const { isReviewActive } = useDiffReviewStore();
  const { request: confirmRequest } = useConfirmationStore();
  const { phase: expertPhase, addIntervention } = useExpertsStore();
  const { activeArtifactTab, setActiveArtifactTab, specContent } = useQuestStore();

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { attachments, images, documents, addFiles, addFileFromFile, removeAttachment, clearAttachments, fileInputRef, triggerFileInput, totalSize } = useFileAttachments();
  const { isPolishing, polish } = usePromptPolish();
  const { isRecording, toggleRecording } = useVoiceInput(useCallback((newText: string) => setInputText(newText), []));

  const handlePolish = useCallback(async () => {
    console.log('[ChatPanel] handlePolish called, inputText:', inputText?.substring(0, 50));
    if (inputText.trim()) {
      try {
        const enhanced = await polish(inputText);
        console.log('[ChatPanel] Polish result:', enhanced?.substring(0, 100));
        setInputText(enhanced);
      } catch (err) {
        console.error('[ChatPanel] Polish error:', err);
      }
    } else {
      console.log('[ChatPanel] No input text to polish');
    }
  }, [inputText, polish]);

  useEffect(() => {
    if (!currentConversationId) {
      createNewConversation();
    }
  }, [currentConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamText]);

  const handleSend = useCallback(async (text: string, _contexts?: any[], attachedFiles?: FileAttachment[]) => {
    if ((!text.trim() && attachments.length === 0) || isStreaming) return;

    let finalPrompt = text;

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
    addMessage(userMsg);
    setStreaming(true);
    resetStreamText();
    setLastUsage(null);
    setCodeContext(null);
    setInputText('');
    clearAttachments();

    try {
      let agentPrompt = finalPrompt;
      const { conversationSummary } = useChatStore.getState();
      if (conversationSummary) {
        agentPrompt = `[Previous conversation summary]\n${conversationSummary}\n\n[Current message]\n${finalPrompt}`;
        setConversationSummary(null);
      }
      const convId = useChatStore.getState().currentConversationId;
      const imagePayload = images.length > 0
        ? images.map(img => {
            const m = img.dataUrl?.match(/^data:(image\/\w+);base64,(.+)$/);
            return m ? { data: m[2], mediaType: m[1] } : null;
          }).filter(Boolean) as Array<{ data: string; mediaType: string }>
        : undefined;

      const documentPayload = documents
        .filter(d => d.parseStatus === 'success' && d.content)
        .map(d => ({ name: d.name, content: d.content!, ext: d.ext }));

      // Pass the full conversation messages so the agent can hydrate its context
      const storeMessages = useChatStore.getState().messages;
      const convMessages = storeMessages.map((m) => ({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
      }));

      await window.electronAPI.agent.run(agentPrompt, {
        mode: chatMode,
        conversationId: convId || undefined,
        images: imagePayload,
        documents: documentPayload.length > 0 ? documentPayload : undefined,
        conversationMessages: convMessages,
      });
    } catch (err) {
      console.error('Agent run failed:', err);
    } finally {
      useChatStore.getState().setStreaming(false);
    }
  }, [isStreaming, codeContext, attachments, images, documents, chatMode, messages, addMessage, setStreaming, resetStreamText, setLastUsage, setCodeContext, setConversationSummary, createNewConversation, clearAttachments]);

  const handleStop = useCallback(async () => {
    try { await window.electronAPI.agent.abort(); } catch { /* ignore */ }
  }, []);

  const handleAskUserReply = useCallback(async (answer: string) => {
    if (!askUserRequest) return;
    await window.electronAPI.agent.replyAskUser(askUserRequest.requestId, answer);
    setAskUserRequest(null);
  }, [askUserRequest, setAskUserRequest]);

  const handleIntervention = useCallback((text: string) => {
    addIntervention(text);
  }, [addIntervention]);

  const handleFileAdd = useCallback((file: File) => {
    addFileFromFile(file);
  }, [addFileFromFile]);

  return (
    <div className="h-full flex bg-cp-bg">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatHeader />

        {!compact && (
          <div className="shrink-0 px-4 py-1 border-b border-cp-border/50">
            <ChatModeSelector />
          </div>
        )}

        {confirmRequest && <ConfirmationBanner />}

        {expertPhase !== 'idle' && (
          <div className="shrink-0 px-3 py-2 border-b border-cp-border/50">
            <ExpertStatusPanel />
          </div>
        )}

        {!isStreaming && isReviewActive && (
          <div className="shrink-0 px-3 py-1.5 border-b border-cp-border/50">
            <AcceptRejectBar />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className={compact ? 'px-3 py-2 space-y-2' : 'px-4 py-4 space-y-3'}>
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-8">
                <p className="text-cp-text-dim/40 text-xs">开始一段新对话</p>
                <p className="text-cp-text-dim/30 text-[10px] mt-1">输入消息开始与 AI 对话</p>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessageView key={msg.id} message={msg} />
            ))}

            {isStreaming && currentStreamText && (
              <ChatMessageView
                message={{ id: 'streaming', role: 'assistant', content: currentStreamText, timestamp: Date.now() }}
              />
            )}

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

            {isStreaming && <FileEditTracker />}
            {!isStreaming && <TodoTracker />}
            {!isStreaming && isReviewActive && <FileChangeSummary />}

            {askUserRequest && (
              <div className="bg-cp-accent/10 border border-cp-accent/30 rounded-lg p-3">
                <p className="text-xs text-cp-info">{askUserRequest.question}</p>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        handleAskUserReply((e.target as HTMLInputElement).value.trim());
                      }
                    }}
                    placeholder="输入回复..."
                    className="flex-1 bg-black/30 border border-cp-border/50 rounded px-2 py-1 text-xs text-cp-text outline-none focus:border-cp-accent/50 placeholder:text-cp-text-dim/40"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {!isStreaming && messages.length > 0 && (
              <ContextMeter
                cumulativeTokens={cumulativeTokens}
                maxContextTokens={maxContextTokens}
                isCompacting={isCompacting}
                canCompact={messages.length >= 4 && cumulativeTokens >= 2000 && !isStreaming && !isCompacting}
                onCompact={compactChat}
              />
            )}

            {!isStreaming && recommendations.length > 0 && messages.length > 0 && (
              <RecommendationCards
                recommendations={recommendations}
                onSelect={(text) => setInputText(text)}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="shrink-0">
          {askUserRequest ? (
            <AskUserCompact onReply={handleAskUserReply} />
          ) : (
            <ChatInput
              onSend={handleSend}
              onStop={handleStop}
              disabled={isStreaming}
              isStreaming={isStreaming}
              interventionMode={chatMode === 'experts' && expertPhase === 'dispatching'}
              onIntervention={handleIntervention}
              onFileAdd={handleFileAdd}
              attachments={attachments}
              onRemoveAttachment={removeAttachment}
              onFile={() => fileInputRef.current?.click()}
              onVoice={() => toggleRecording(inputText)}
              onPolish={handlePolish}
              isRecording={isRecording}
              isPolishing={isPolishing}
              canSend={!!inputText.trim() || attachments.length > 0}
              fileInputRef={fileInputRef}
              value={inputText}
              onChange={setInputText}
            />
          )}
        </div>

      </div>

      {/* Right Artifact Panel */}
      {!compact && (
        <div className="w-80 border-l border-cp-border/30 flex flex-col">
          {/* Tab bar */}
          <div className="flex items-center border-b border-cp-border/30 px-1 shrink-0">
            {['spec', 'files', 'preview'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveArtifactTab(tab as any)}
                className={`px-3 py-2 text-[11px] transition-colors relative ${
                  activeArtifactTab === tab
                    ? 'text-cp-text'
                    : 'text-white/70 hover:text-cp-text'
                }`}
              >
                {tab === 'spec' ? 'Spec' : tab === 'files' ? 'Changed Files' : 'Preview'}
                {activeArtifactTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cp-accent" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeArtifactTab === 'spec' && <QuestSpecTab />}
            {activeArtifactTab === 'files' && <QuestChangedFilesTab />}
            {activeArtifactTab === 'preview' && <QuestPreviewTab />}
          </div>
        </div>
      )}
    </div>
  );
}

function AskUserCompact({ onReply }: { onReply: (answer: string) => void }) {
  const [answer, setAnswer] = useState('');
  return (
    <div className="p-3 bg-cp-panel border-t border-cp-border">
      <div className="bg-cp-accent/10 border border-cp-accent/30 rounded-lg overflow-hidden px-3 py-2">
        <span className="text-[9px] text-cp-accent/70 uppercase tracking-wider">等待回复</span>
        <div className="flex gap-2 mt-1.5">
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
            placeholder="输入回复..."
            className="flex-1 bg-black/30 border border-cp-border/50 rounded px-2 py-1 text-xs text-cp-text outline-none focus:border-cp-accent/50 placeholder:text-cp-text-dim/40"
            autoFocus
          />
          <button
            onClick={() => { if (answer.trim()) { onReply(answer.trim()); setAnswer(''); } }}
            disabled={!answer.trim()}
            className="px-2 py-1 bg-cp-accent text-white rounded text-[10px] disabled:opacity-30 transition-colors"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
