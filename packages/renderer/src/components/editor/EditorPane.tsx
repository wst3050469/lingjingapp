import { useEditorStore } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { useDiffReviewStore } from '../../stores/diff-review-store';
import { EditorTabs } from './EditorTabs';
import { MonacoEditor } from './MonacoEditor';
import { DiffReviewBar } from './DiffReviewBar';
import { DiffEditorView } from './DiffEditorView';

export function EditorPane() {
  const { openFiles, activeFilePath } = useEditorStore();
  const { activeTopTab } = useUIStore();
  const { isReviewActive, activeReviewFile } = useDiffReviewStore();
  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  return (
    <div className="h-full flex flex-col bg-cp-editor">
      {openFiles.length > 0 || isReviewActive ? (
        <>
          <EditorTabs />
          {isReviewActive && <DiffReviewBar />}
          <div className="flex-1 overflow-hidden">
            {isReviewActive && activeReviewFile ? (
              <DiffEditorView />
            ) : activeFile ? (
              <MonacoEditor
                key={activeFile.path}
                path={activeFile.path}
                language={activeFile.language}
                value={activeFile.content}
                onChange={(value) => {
                  useEditorStore.getState().updateFileContent(activeFile.path, value);
                }}
              />
            ) : (
              <WelcomeScreen />
            )}
          </div>
        </>
      ) : (
        <WelcomeScreen />
      )}
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="h-full flex items-center justify-center text-cp-text-dim">
      <div className="text-center">
        <h1 className="text-4xl font-light mb-4 text-cp-text/30">灵境</h1>
        <p className="text-sm">Open a file from the Explorer or start a conversation in the Chat panel</p>
        <div className="mt-6 text-xs space-y-1">
          <p><kbd className="px-1.5 py-0.5 bg-cp-border rounded text-cp-text">Ctrl+O</kbd> Open Folder</p>
          <p><kbd className="px-1.5 py-0.5 bg-cp-border rounded text-cp-text">Ctrl+S</kbd> Save File</p>
        </div>
      </div>
    </div>
  );
}
