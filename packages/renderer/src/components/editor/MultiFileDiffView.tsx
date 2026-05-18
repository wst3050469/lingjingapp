import React from 'react';
import { useMultiFileEditStore } from '../../stores/multi-file-edit-store';
import type { FileDiff } from '@codepilot/core/multi-file-edit';

export const MultiFileDiffView: React.FC = () => {
  const { session, acceptFile, rejectFile } = useMultiFileEditStore();

  if (!session) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {session.files.map((file, idx) => (
          <div key={file.filePath} className={`px-3 py-2 text-xs whitespace-nowrap ${idx === 0 ? 'bg-gray-100 dark:bg-gray-800 border-b-2 border-blue-500' : ''}`}>
            {file.filePath}
            {file.hasConflict && <span className="ml-1 text-orange-500">⚠</span>}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {session.files.map(file => (
          <FileDiffCard key={file.filePath} diff={file} onAccept={() => acceptFile(file.filePath)} onReject={() => rejectFile(file.filePath)} />
        ))}
      </div>
    </div>
  );
};

const FileDiffCard: React.FC<{ diff: FileDiff; onAccept: () => void; onReject: () => void }> = ({ diff, onAccept, onReject }) => {
  const allDecided = diff.hunks.every(h => h.decision !== 'pending');

  return (
    <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800">
        <span className="text-xs font-medium">{diff.filePath}</span>
        {!allDecided && (
          <div className="flex gap-2">
            <button onClick={onAccept} className="px-2 py-0.5 text-xs bg-green-600 text-white rounded">全部接受</button>
            <button onClick={onReject} className="px-2 py-0.5 text-xs bg-red-600 text-white rounded">全部拒绝</button>
          </div>
        )}
      </div>
      <pre className="p-3 text-xs overflow-x-auto font-mono">
        {diff.hunks.map(hunk => (
          <div key={hunk.id} className={hunk.decision === 'accepted' ? 'bg-green-50 dark:bg-green-900/20' : hunk.decision === 'rejected' ? 'bg-red-50 dark:bg-red-900/20' : ''}>
            {hunk.content.split('\n').map((line, i) => (
              <div key={i} className={line.startsWith('+') ? 'text-green-600' : line.startsWith('-') ? 'text-red-600' : ''}>
                {line}
              </div>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
};
