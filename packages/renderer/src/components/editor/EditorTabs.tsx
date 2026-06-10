import { useEditorStore } from '../../stores/editor-store';

export function EditorTabs() {
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useEditorStore();

  return (
    <div className="flex bg-cp-tab-inactive border-b border-cp-border overflow-x-auto">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        return (
          <div
            key={file.path}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer border-r border-cp-border select-none
              ${isActive ? 'bg-cp-tab-active text-cp-text' : 'text-cp-text-dim hover:text-cp-text hover:bg-cp-bg/50'}`}
            onClick={() => setActiveFile(file.path)}
          >
            <span className="truncate max-w-[120px]">{file.name}</span>
            {file.isDirty && <span className="text-cp-warning ml-0.5">{'\u25CF'}</span>}
            <button
              className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 text-cp-text-dim hover:text-cp-text"
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
            >
              {'\u00D7'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
