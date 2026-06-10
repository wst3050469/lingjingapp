import { useState, useEffect } from 'react';
import type { LoginRecord } from '@codepilot/core';

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h4 className="text-xs font-medium text-cp-text-dim/70 uppercase tracking-wider">{title}</h4>
      <div className="flex-1 h-px bg-cp-border/20" />
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

export function LoginHistoryPanel() {
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.cloudManagement.user.getLoginHistory(50);
      setRecords(data);
    } catch (error) {
      console.error('Failed to load login history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cp-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="登录历史" />
      
      <Card>
        {records.length === 0 ? (
          <p className="text-sm text-cp-text-dim">暂无登录记录</p>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className="flex items-start gap-3 py-2 border-b border-cp-border/10 last:border-0"
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 ${record.success ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-cp-text">{record.device}</p>
                    <span className="text-xs text-cp-text-dim">{record.ipAddress}</span>
                  </div>
                  <p className="text-xs text-cp-text-dim mt-0.5">
                    {new Date(record.timestamp).toLocaleString()} · {record.location}
                  </p>
                  {!record.success && record.failureReason && (
                    <p className="text-xs text-red-400 mt-1">失败原因: {record.failureReason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
