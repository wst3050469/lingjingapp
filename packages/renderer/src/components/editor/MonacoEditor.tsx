import { useRef, useEffect } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditor_NS } from 'monaco-editor';
import { NextInlineProvider } from '../../editor/NextInlineProvider';
import { InlineChatController } from '../../editor/InlineChatController';
import { useNextStore } from '../../stores/next-store';

interface MonacoEditorProps {
  path: string;
  language: string;
  value: string;
  onChange: (value: string) => void;
}

// Singleton provider registration (one per Monaco instance)
let providerDisposable: { dispose(): void } | null = null;
let providerInstance: NextInlineProvider | null = null;

export function MonacoEditor({ path, language, value, onChange }: MonacoEditorProps) {
  const editorRef = useRef<MonacoEditor_NS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const inlineChatRef = useRef<InlineChatController | null>(null);

  const handleSave = async () => {
    try {
      await window.electronAPI.fs.writeFile(path, value);
      const { useEditorStore } = await import('../../stores/editor-store');
      useEditorStore.getState().markDirty(path, false);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const handleSendToChat = async (editorInstance: MonacoEditor_NS.IStandaloneCodeEditor) => {
    const selection = editorInstance.getSelection();
    const model = editorInstance.getModel();
    if (!selection || !model) return;

    const selectedText = model.getValueInRange(selection);
    if (!selectedText.trim()) return;

    const { useChatStore } = await import('../../stores/chat-store');
    const { useUIStore } = await import('../../stores/ui-store');

    useChatStore.getState().setCodeContext({
      code: selectedText,
      filePath: path,
      language,
      startLine: selection.startLineNumber,
      endLine: selection.endLineNumber,
    });

    useChatStore.getState().setChatMode('ask');

    const uiStore = useUIStore.getState();
    if (!uiStore.showSidebar || uiStore.activeSidebarPanel !== 'chat') {
      uiStore.setSidebarPanel('chat');
      if (!uiStore.showSidebar) uiStore.toggleSidebar();
    }

    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('[data-chat-input]');
      textarea?.focus();
    }, 50);
  };

  const handleSendFileToChat = async (editorInstance: MonacoEditor_NS.IStandaloneCodeEditor) => {
    const model = editorInstance.getModel();
    if (!model) return;

    const fullContent = model.getValue();
    if (!fullContent.trim()) return;

    const { useChatStore } = await import('../../stores/chat-store');
    const { useUIStore } = await import('../../stores/ui-store');

    useChatStore.getState().setCodeContext({
      code: fullContent,
      filePath: path,
      language,
    });

    useChatStore.getState().setChatMode('ask');

    const uiStore = useUIStore.getState();
    if (!uiStore.showSidebar || uiStore.activeSidebarPanel !== 'chat') {
      uiStore.setSidebarPanel('chat');
      if (!uiStore.showSidebar) uiStore.toggleSidebar();
    }

    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('[data-chat-input]');
      textarea?.focus();
    }, 50);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      inlineChatRef.current?.dispose();
      inlineChatRef.current = null;
      editorRef.current = null;
    };
  }, []);

  const handleEditorMount = (editor: MonacoEditor_NS.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ctrl+S to save
    editor.addCommand(2097 /* KeyMod.CtrlCmd | KeyCode.KeyS */, handleSave);

    // Context menu: Send selection to Chat (Ctrl+Shift+L)
    editor.addAction({
      id: 'send-to-chat',
      label: '发送到聊天',
      keybindings: [2048 + 1024 + 42],
      contextMenuGroupId: '9_cutcopypaste',
      contextMenuOrder: 10,
      precondition: 'editorHasSelection',
      run: (ed) => handleSendToChat(ed as any),
    });

    // Context menu: Send entire file to Chat
    editor.addAction({
      id: 'send-file-to-chat',
      label: '发送整个文件到聊天',
      contextMenuGroupId: '9_cutcopypaste',
      contextMenuOrder: 11,
      run: (ed) => handleSendFileToChat(ed as any),
    });

    // --- Inline Chat: Ctrl+I to open ---
    inlineChatRef.current = new InlineChatController(editor, monaco as any, path, language);

    // Expose editor store for InlineChatController to access open files
    import('../../stores/editor-store').then(({ useEditorStore }) => {
      (window as any).__editorStoreForInlineChat = useEditorStore;
    });

    editor.addAction({
      id: 'inline-chat',
      label: '行间会话',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
      contextMenuGroupId: '9_cutcopypaste',
      contextMenuOrder: 12,
      run: () => inlineChatRef.current?.open(),
    });

    // --- NEXT: Register InlineCompletionsProvider ---
    if (!providerDisposable) {
      providerInstance = new NextInlineProvider(monaco as any);
      providerDisposable = monaco.languages.registerInlineCompletionsProvider(
        { pattern: '**' },
        providerInstance as any
      );
    }

    // --- NEXT: Track content changes for context-aware predictions ---
    const changeDisposable = editor.onDidChangeModelContent((e) => {
      for (const change of e.changes) {
        if (change.text || change.rangeLength > 0) {
          const oldText = change.rangeLength > 0
            ? `[${change.rangeLength} chars removed]`
            : '';
          useNextStore.getState().addRecentChange({
            filePath: path,
            oldText,
            newText: change.text.slice(0, 100),
            timestamp: Date.now(),
          });
        }
      }
    });

    // --- NEXT: Alt key preview (show full diff) ---
    let altPreviewActive = false;

    const keyDownDisposable = editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Alt && !altPreviewActive) {
        altPreviewActive = true;
        // When Alt is pressed, show a subtle visual indicator
        const model = editor.getModel();
        if (model) {
          decorationsRef.current = editor.deltaDecorations(
            decorationsRef.current,
            [{
              range: new monaco.Range(
                editor.getPosition()?.lineNumber || 1,
                1,
                editor.getPosition()?.lineNumber || 1,
                1
              ),
              options: {
                isWholeLine: true,
                className: 'next-alt-preview-line',
                overviewRuler: {
                  color: '#4fc1ff33',
                  position: monaco.editor.OverviewRulerLane.Center,
                },
              },
            }]
          );
        }
      }
    });

    const keyUpDisposable = editor.onKeyUp((e) => {
      if (e.keyCode === monaco.KeyCode.Alt && altPreviewActive) {
        altPreviewActive = false;
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      }
    });

    // Dispose listeners when editor is disposed
    editor.onDidDispose(() => {
      changeDisposable.dispose();
      keyDownDisposable.dispose();
      keyUpDisposable.dispose();
      inlineChatRef.current?.dispose();
    });
  };

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme="vs-dark"
      onChange={(val) => onChange(val ?? '')}
      onMount={handleEditorMount}
      options={{
        fontSize: 14,
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        minimap: { enabled: true },
        wordWrap: 'off',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        renderWhitespace: 'selection',
        lineNumbers: 'on',
        glyphMargin: false,
        folding: true,
        bracketPairColorization: { enabled: true },
        // NEXT: Enable inline suggestions
        inlineSuggest: { enabled: true },
      }}
    />
  );
}
