import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';

interface ConflictDialogProps {
  conflicts: Conflict[];
  onResolve: (conflictId: string, strategy: ResolutionStrategy) => Promise<void>;
  onClose: () => void;
}

interface Conflict {
  id: string;
  conflictType: string;
  dataId: string;
  dataType: string;
  localVersion: any;
  remoteVersion: any;
  localTimestamp: number;
  remoteTimestamp: number;
}

type ResolutionStrategy = 'local_win' | 'remote_win' | 'manual' | 'auto_merge';

export const ConflictDialog: React.FC<ConflictDialogProps> = ({ conflicts, onResolve, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [strategy, setStrategy] = useState<ResolutionStrategy>('local_win');

  const currentConflict = conflicts[currentIndex];
  const totalConflicts = conflicts.length;

  const handleResolve = async () => {
    if (!currentConflict) return;

    setResolving(true);
    try {
      await onResolve(currentConflict.id, strategy);
      setResolvedCount(prev => prev + 1);
      
      if (currentIndex < totalConflicts - 1) {
        setCurrentIndex(prev => prev + 1);
        setStrategy('local_win');
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    } finally {
      setResolving(false);
    }
  };

  const handleBatchResolve = async (batchStrategy: ResolutionStrategy) => {
    setResolving(true);
    try {
      for (let i = currentIndex; i < conflicts.length; i++) {
        await onResolve(conflicts[i].id, batchStrategy);
        setResolvedCount(prev => prev + 1);
      }
      onClose();
    } catch (err) {
      console.error('Batch resolve failed:', err);
    } finally {
      setResolving(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!currentConflict) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-cp-surface border border-cp-border rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 text-green-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-lg font-medium">所有冲突已解决</span>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cp-surface border border-cp-border rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cp-border">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            <div>
              <h2 className="text-lg font-semibold text-cp-text">同步冲突</h2>
              <p className="text-sm text-cp-text-secondary">
                {resolvedCount > 0 ? `已解决 ${resolvedCount}/${totalConflicts} · ` : ''}
                剩余 {totalConflicts - currentIndex} 个冲突
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-cp-surface-hover rounded">
            <X className="w-5 h-5 text-cp-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-cp-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-cp-text">本地版本</span>
                <span className="text-xs text-cp-text-secondary">
                  {formatDate(currentConflict.localTimestamp)}
                </span>
              </div>
              <pre className="text-xs text-cp-text-secondary bg-cp-surface-hover p-3 rounded overflow-auto max-h-48">
                {JSON.stringify(currentConflict.localVersion, null, 2)}
              </pre>
            </div>

            <div className="border border-cp-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-cp-text">云端版本</span>
                <span className="text-xs text-cp-text-secondary">
                  {formatDate(currentConflict.remoteTimestamp)}
                </span>
              </div>
              <pre className="text-xs text-cp-text-secondary bg-cp-surface-hover p-3 rounded overflow-auto max-h-48">
                {JSON.stringify(currentConflict.remoteVersion, null, 2)}
              </pre>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="text-sm font-medium text-cp-text">选择解决策略：</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setStrategy('local_win')}
                className={`px-4 py-2 rounded border ${
                  strategy === 'local_win'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-cp-border hover:bg-cp-surface-hover text-cp-text-secondary'
                }`}
              >
                保留本地
              </button>
              <button
                onClick={() => setStrategy('remote_win')}
                className={`px-4 py-2 rounded border ${
                  strategy === 'remote_win'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-cp-border hover:bg-cp-surface-hover text-cp-text-secondary'
                }`}
              >
                使用云端
              </button>
              <button
                onClick={() => setStrategy('auto_merge')}
                className={`px-4 py-2 rounded border ${
                  strategy === 'auto_merge'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-cp-border hover:bg-cp-surface-hover text-cp-text-secondary'
                }`}
              >
                自动合并
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-cp-border bg-cp-surface-hover">
          <div className="flex gap-2">
            <button
              onClick={() => handleBatchResolve('local_win')}
              disabled={resolving}
              className="px-3 py-1.5 text-sm text-cp-text-secondary hover:text-cp-text hover:bg-cp-surface rounded"
            >
              全部保留本地
            </button>
            <button
              onClick={() => handleBatchResolve('remote_win')}
              disabled={resolving}
              className="px-3 py-1.5 text-sm text-cp-text-secondary hover:text-cp-text hover:bg-cp-surface rounded"
            >
              全部使用云端
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentIndex > 0 && (
              <button
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className="px-4 py-2 text-sm text-cp-text-secondary hover:text-cp-text rounded"
              >
                上一个
              </button>
            )}
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              {resolving ? (
                '处理中...'
              ) : (
                <>
                  解决并继续
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
