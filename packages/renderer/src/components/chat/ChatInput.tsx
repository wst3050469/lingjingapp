import { useState, useRef, useEffect } from 'react';
import { useModelStore } from '../../stores/model-store';
import { useContextSelector } from '../../hooks/useContextSelector';
import { useDragDropFiles } from '../../hooks/useDragDropFiles';
import { ContextSelector } from '../context/ContextSelector';
import { ContextChips } from '../context/ContextChips';
import { InputToolbar } from './InputToolbar';
import { ChatActionBar } from './ChatActionBar';
import type { MentionItem } from '../../types/mention';
import type { AttachedImage } from '../../stores/chat-store';

interface ChatInputProps {
  onSend: (text: string, contexts?: MentionItem[], images?: AttachedImage[]) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  interventionMode?: boolean;
  onIntervention?: (text: string) => void;
  onImageAdd?: (file: File) => void;
  images?: AttachedImage[];
  onRemoveImage?: (index: number) => void;
  // InputToolbar props
  onImage?: () => void;
  onVoice?: () => void;
  onPolish?: () => void;
  isRecording?: boolean;
  isPolishing?: boolean;
  canSend?: boolean;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  // Controlled mode: external parent can drive the input
  value?: string;
  onChange?: (text: string) => void;
}

export function ChatInput({
  onSend, onStop, disabled, isStreaming, interventionMode, onIntervention,
  onImageAdd, images, onRemoveImage,
  onImage, onVoice, onPolish,
  isRecording = false, isPolishing = false, canSend: canSendProp,
  fileInputRef: externalFileInputRef,
  value: externalValue,
  onChange: externalOnChange,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { currentModel } = useModelStore();

  const {
    showSelector,
    searchQuery: mentionQuery,
    selectedContexts,
    handleTextChange,
    handleSelect,
    openViaButton,
    dismissSelector,
    setSearchQuery,
    removeContext,
    clearContexts,
  } = useContextSelector('chat');

  const { isDragging, dragHandlers, pasteHandler } = useDragDropFiles('chat', { onImageAdd });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [text]);

  // Sync external value -> internal text (controlled mode)
  useEffect(() => {
    if (externalValue !== undefined && externalValue !== text) {
      setText(externalValue);
    }
  }, [externalValue]);

  const handleSubmit = () => {
    if (!text.trim() && (!images || images.length === 0)) return;

    if (interventionMode && onIntervention) {
      onIntervention(text.trim());
      setText('');
    } else if (!disabled) {
      const contexts = selectedContexts.length > 0 ? [...selectedContexts] : undefined;
      const attachedImages = images && images.length > 0 ? [...images] : undefined;
      onSend(text.trim(), contexts, attachedImages);
      setText('');
      clearContexts();
      dismissSelector();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSelector) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // In intervention mode, the input is always enabled (even while streaming)
  const inputDisabled = interventionMode ? false : disabled;

  const modelShort = currentModel
    ? currentModel.replace(/^ollama:/, '').replace(/^openai:/, '').replace(/^anthropic:/, '').split(':')[0]
    : '';

  return (
    <div className="p-4">
      <div
        className={`bg-cp-panel border rounded-2xl overflow-hidden transition-all duration-200 relative shadow-lg ${
          isDragging ? 'border-blue-500/40 bg-blue-500/5 shadow-blue-500/10' :
          interventionMode
            ? 'border-amber-500/40 focus-within:border-amber-400/60 shadow-amber-500/5'
            : 'border-white/[0.06] focus-within:border-cp-accent/40 focus-within:shadow-cp-accent/5'
        }`}
        {...dragHandlers}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-500/10 rounded-2xl pointer-events-none">
            <span className="text-sm text-blue-400">Drop files here</span>
          </div>
        )}

        {interventionMode && (
          <div className="px-4 pt-2">
            <span className="text-[10px] text-amber-400/80 uppercase tracking-wider font-medium">
              {'\u5b9e\u65f6\u5e72\u9884'} - {'\u4e13\u5bb6\u56e2\u6267\u884c\u4e2d'}
            </span>
          </div>
        )}

        {/* Image thumbnails */}
        {images && images.length > 0 && (
          <div className="pt-2 px-2 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={`img-${i}`} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                <button
                  onClick={() => onRemoveImage?.(i)}
                  className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-black/60 text-white/80 rounded-bl-lg text-xs hover:bg-red-600/80 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Context chips */}
        {selectedContexts.length > 0 && (
          <div className="pt-1.5 px-2">
            <ContextChips
              contexts={selectedContexts}
              onRemoveContext={removeContext}
            />
          </div>
        )}

        {/* ── Action Bar（文件上传 + 语音 + 任务停止）── */}
        <ChatActionBar
          onFileUpload={() => externalFileInputRef?.current?.click()}
          onVoice={() => onVoice?.()}
          onStop={() => onStop?.()}
          isRecording={isRecording}
          isStreaming={!!isStreaming}
          disabled={inputDisabled}
        />

        <textarea
          ref={textareaRef}
          data-chat-input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            externalOnChange?.(e.target.value);
            const cursorPos = e.target.selectionStart;
            handleTextChange(e.target.value, cursorPos);
          }}
          onKeyDown={handleKeyDown}
          onPaste={pasteHandler}
          onClick={() => {
            if (textareaRef.current) {
              const cursorPos = textareaRef.current.selectionStart;
              handleTextChange(text, cursorPos);
            }
          }}
          placeholder={
            interventionMode
              ? '\u8f93\u5165\u5e72\u9884\u6307\u4ee4\uff0c\u5c06\u5728\u4e0b\u4e00\u8f6e\u6ce8\u5165 Team Lead... (Enter \u53d1\u9001)'
              : disabled
                ? '\u7b49\u5f85\u56de\u590d\u4e2d...'
                : '\u7ed9\u7075\u5883\u53d1\u6d88\u606f... (@ \u6dfb\u52a0\u4e0a\u4e0b\u6587, Enter \u53d1\u9001)'
          }
          disabled={inputDisabled}
          rows={1}
          className="w-full bg-transparent px-4 pt-3 pb-1 text-sm text-cp-text
            outline-none resize-none disabled:opacity-50 min-h-[40px] placeholder:text-cp-text-dim/50"
        />

        {/* Context Selector */}
        {showSelector && (
          <ContextSelector
            show={showSelector}
            scope="chat"
            onDismiss={dismissSelector}
            onSelect={(item) => handleSelect(item, text, setText)}
            searchQuery={mentionQuery}
            onQueryChange={setSearchQuery}
          />
        )}
        {/* Toolbar */}
        {interventionMode ? (
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-[10px] text-amber-400/50 px-2 py-0.5 rounded-full bg-amber-500/10">
              {'\u5e72\u9884\u6a21\u5f0f'}
            </span>
            <div className="flex-1" />
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium
                hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {'\u53d1\u9001\u5e72\u9884'}
            </button>
          </div>
        ) : (
          <div className="px-2 pb-1.5 flex items-center gap-1.5">
            {modelShort && (
              <span className="text-[10px] text-cp-text-dim/60 px-2 py-0.5 rounded-full bg-white/5 shrink-0">
                {modelShort}
              </span>
            )}
            <div className="flex-1" />
            <InputToolbar
              onPolish={() => {
                console.log('[ChatInput] onPolish called, onPolish exists:', !!onPolish);
                if (onPolish) {
                  onPolish();
                } else {
                  console.error('[ChatInput] No onPolish callback provided');
                }
              }}
              onSend={handleSubmit}
              isStreaming={!!isStreaming}
              isPolishing={isPolishing}
              canSend={typeof canSendProp === 'boolean' ? canSendProp : (!!text.trim() || (!!images && images.length > 0))}
            />
          </div>
        )}

        {/* Hidden file input for image upload */}
        <input
          ref={externalFileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files && onImageAdd) {
              Array.from(files).forEach((file) => {
                console.log('[ChatInput] Processing image upload:', file.name);
                onImageAdd(file);
              });
            }
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
