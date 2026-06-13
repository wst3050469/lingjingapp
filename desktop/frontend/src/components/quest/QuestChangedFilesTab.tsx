// Quest Changed Files Tab - diff review of agent file changes

import { useQuestDiffStore, type QuestFileChange } from '../../stores/quest-diff-store';
import { useQuestStore } from '../../stores/quest-store';

export function QuestChangedFilesTab() {
  const { fileChanges, activeReviewFile, setActiveReviewFile, acceptFile, rejectFile, acceptAll, rejectAll } =
    useQuestDiffStore();

  const { messages, isStreaming } = useQuestStore();
  const hasAgentRun = messages.length > 0;

  const files = Object.values(fileChanges);
  const pendingCount = files.filter((f) => f.status === 'pending').length;

  if (files.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 text-center">
        <svg className="w-8 h-8 text-white/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <div className="text-white/70 text-[11px] mb-2">
          {isStreaming ? '等待文件变更...' : hasAgentRun ? '暂无文件变更' : '尚未开始任务'}
        </div>
        <p className="text-white/60 text-[10px] max-w-[220px] leading-relaxed">
          {isStreaming
            ? 'AI 正在执行任务，当 AI 创建或编辑文件时，变更会实时出现在这里。'
            : hasAgentRun
              ? 'AI 已完成任务但未产生文件变更。如果期望 AI 修改代码，请确认任务描述中包含明确的文件操作要求。'
              : '启动一个 Spec 或 Prototype 场景的任务，AI 创建或编辑的文件变更会出现在这里供你审查。'
          }
        </p>
      </div>
    );
  }

  const activeFile = activeReviewFile ? fileChanges[activeReviewFile] : null;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cp-border/30">
        <span className="text-[10px] text-white/80">
          {files.length} 个文件变更
          {pendingCount > 0 && (
            <span className="ml-1 text-yellow-400">({pendingCount} 待审查)</span>
          )}
        </span>
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
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* File list */}
        <div className={`${activeFile ? 'w-[180px]' : 'w-full'} border-r border-cp-border/20 overflow-y-auto shrink-0`}>
          {(files ?? []).map((file) => (
            <FileEntry
              key={file.filePath}
              file={file}
              isActive={file.filePath === activeReviewFile}
              onSelect={() => setActiveReviewFile(file.filePath)}
              onAccept={() => acceptFile(file.filePath)}
              onReject={() => rejectFile(file.filePath)}
            />
          ))}
        </div>

        {/* Diff preview */}
        {activeFile && (
          <div className="flex-1 overflow-y-auto">
            <SimpleDiffView file={activeFile} />
          </div>
        )}
      </div>
    </div>
  );
}

function FileEntry({
  file,
  isActive,
  onSelect,
  onAccept,
  onReject,
}: {
  file: QuestFileChange;
  isActive: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const statusColor =
    file.status === 'accepted'
      ? 'text-green-400'
      : file.status === 'rejected'
        ? 'text-red-400'
        : 'text-yellow-400';

  return (
    <div
      onClick={onSelect}
      className={`group px-3 py-2 cursor-pointer border-b border-cp-border/15 transition-colors ${
        isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* File status indicator */}
        <span className={`text-[9px] shrink-0 ${statusColor}`}>
          {file.isNewFile ? '+' : '~'}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-white/80 truncate">{file.fileName}</p>
        </div>

        {/* Per-file accept/reject */}
        {file.status === 'pending' && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              className="w-5 h-5 flex items-center justify-center rounded text-green-400 hover:bg-green-500/15 text-[10px]"
              title="Accept"
            >
              &#10003;
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              className="w-5 h-5 flex items-center justify-center rounded text-red-400 hover:bg-red-500/15 text-[10px]"
              title="Reject"
            >
              &#10005;
            </button>
          </div>
        )}

        {file.status !== 'pending' && (
          <span className={`text-[9px] ${statusColor} capitalize`}>{file.status}</span>
        )}
      </div>
    </div>
  );
}

function SimpleDiffView({ file }: { file: QuestFileChange }) {
  const beforeLines = file.beforeContent?.split('\n') || [];
  const afterLines = file.afterContent.split('\n');

  // Simple line-by-line diff display
  if (file.isNewFile) {
    return (
      <div className="p-3">
        <div className="text-[10px] text-green-400/60 mb-2 uppercase tracking-wider">新文件</div>
        <pre className="text-[11px] leading-relaxed font-mono text-white/80 whitespace-pre-wrap break-words">
          {afterLines.map((line, i) => (
            <div key={i} className="bg-green-500/5 border-l-2 border-green-500/30 pl-2 py-px">
              <span className="text-white/40 inline-block w-8 text-right mr-2 select-none">{i + 1}</span>
              {line}
            </div>
          ))}
        </pre>
      </div>
    );
  }

  // For modified files, show a simple before/after
  return (
    <div className="p-3">
      <div className="text-[10px] text-white/60 mb-2 uppercase tracking-wider">修改的文件</div>

      {/* Before */}
      <details className="mb-3">
        <summary className="text-[10px] text-red-400/60 cursor-pointer mb-1 select-none">
          修改前 ({beforeLines.length} 行)
        </summary>
        <pre className="text-[11px] leading-relaxed font-mono text-white/70 whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto bg-red-500/5 rounded p-2">
          {beforeLines.map((line, i) => (
            <div key={i} className="py-px">
              <span className="text-white/40 inline-block w-8 text-right mr-2 select-none">{i + 1}</span>
              {line}
            </div>
          ))}
        </pre>
      </details>

      {/* After */}
      <details open>
        <summary className="text-[10px] text-green-400/60 cursor-pointer mb-1 select-none">
          修改后 ({afterLines.length} 行)
        </summary>
        <pre className="text-[11px] leading-relaxed font-mono text-white/80 whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto bg-green-500/5 rounded p-2">
          {afterLines.map((line, i) => (
            <div key={i} className="py-px">
              <span className="text-white/40 inline-block w-8 text-right mr-2 select-none">{i + 1}</span>
              {line}
            </div>
          ))}
        </pre>
      </details>
    </div>
  );
}
