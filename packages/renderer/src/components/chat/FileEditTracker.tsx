import { useEditTrackerStore, type FileEditStatus } from '../../stores/edit-tracker-store';

const STATUS_CONFIG: Record<FileEditStatus, { color: string; label: string }> = {
  generating: { color: 'text-yellow-400', label: '生成中' },
  applying: { color: 'text-blue-400', label: '应用中' },
  applied: { color: 'text-green-400', label: '已应用' },
  error: { color: 'text-red-400', label: '错误' },
};

export function FileEditTracker() {
  const { trackedEdits } = useEditTrackerStore();

  if (trackedEdits.length === 0) return null;

  return (
    <div className="border border-cp-border/50 rounded-lg overflow-hidden my-2">
      <div className="px-2.5 py-1.5 bg-white/[0.03] text-[10px] text-cp-text-dim/60 uppercase tracking-wider border-b border-cp-border/30">
        文件变更 ({trackedEdits.length})
      </div>
      <div className="divide-y divide-cp-border/20">
        {trackedEdits.map((edit) => {
          const cfg = STATUS_CONFIG[edit.status];
          const fileName = edit.filePath.split(/[/\\]/).pop() || edit.filePath;
          return (
            <div key={edit.filePath} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.color} ${edit.status === 'generating' ? 'animate-pulse' : ''}`} 
                style={{ backgroundColor: 'currentColor' }} />
              <span className="text-cp-text truncate flex-1 font-mono text-[11px]" title={edit.filePath}>
                {fileName}
              </span>
              <span className={`text-[10px] ${cfg.color} shrink-0`}>{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
