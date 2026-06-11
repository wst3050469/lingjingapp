import React, { useState, useEffect } from 'react';
import { GitBranch, RefreshCw, LogOut, Check, Plus } from 'lucide-react';

interface GitHubAuthStatusProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface GitHubAccount {
  id: string;
  username: string;
  avatarUrl?: string;
  status: 'active' | 'expired' | 'revoked' | 'pending';
  isDefault: boolean;
  scope: string[];
}

export const GitHubAuthStatus: React.FC<GitHubAuthStatusProps> = ({ onConnect, onDisconnect }) => {
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [currentAccount, setCurrentAccount] = useState<GitHubAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [showScope, setShowScope] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const accountList = await window.electronAPI?.github?.listAccounts();
      setAccounts(accountList || []);
      const defaultAccount = accountList?.find((a: GitHubAccount) => a.isDefault && a.status === 'active');
      setCurrentAccount(defaultAccount || null);
    } catch (err) {
      console.error('Failed to load GitHub accounts:', err);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      if (onConnect) {
        onConnect();
      } else {
        const authUrl = await window.electronAPI?.github?.generateAuthUrl();
        window.open(authUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to initiate GitHub OAuth:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentAccount) return;
    
    setLoading(true);
    try {
      if (onDisconnect) {
        onDisconnect();
      } else {
        await window.electronAPI?.github?.removeAccount(currentAccount.id);
        await loadAccounts();
      }
    } catch (err) {
      console.error('Failed to disconnect GitHub:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!currentAccount) return;
    
    setLoading(true);
    try {
      await window.electronAPI?.github?.getUser();
    } catch (err) {
      console.error('Failed to refresh GitHub auth:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async (accountId: string) => {
    setLoading(true);
    try {
      await window.electronAPI?.github?.switchAccount(accountId);
      await loadAccounts();
    } catch (err) {
      console.error('Failed to switch account:', err);
    } finally {
      setLoading(false);
    }
  };

  const isExpired = currentAccount?.status === 'expired';
  const isActive = currentAccount?.status === 'active';

  return (
    <div className="flex flex-col gap-2">
      {currentAccount ? (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-cp-surface">
          {currentAccount.avatarUrl ? (
            <img
              src={currentAccount.avatarUrl}
              alt={currentAccount.username}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <GitBranch className="w-8 h-8 text-cp-text-secondary" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-cp-text truncate">
                {currentAccount.username}
              </span>
              {currentAccount.isDefault && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                  默认
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <span className={`text-xs ${isActive ? 'text-green-500' : isExpired ? 'text-yellow-500' : 'text-red-500'}`}>
                {isActive ? '已连接' : isExpired ? '授权已过期' : '授权无效'}
              </span>
              
              {showScope && currentAccount.scope.length > 0 && (
                <span className="text-xs text-cp-text-secondary">
                  ({currentAccount.scope.join(', ')})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isExpired && (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="p-1.5 rounded hover:bg-cp-surface-hover text-yellow-500"
                title="刷新授权"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="p-1.5 rounded hover:bg-cp-surface-hover text-red-500"
              title="断开连接"
            >
              <LogOut className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowScope(!showScope)}
              className="p-1.5 rounded hover:bg-cp-surface-hover text-cp-text-secondary"
              title="显示权限"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cp-surface hover:bg-cp-surface-hover transition-colors"
        >
          <GitBranch className="w-5 h-5" />
          <span className="text-sm text-cp-text">
            {loading ? '连接中...' : '连接 GitHub'}
          </span>
        </button>
      )}

      {accounts.length > 1 && (
        <div className="flex flex-col gap-1 mt-2">
          <div className="text-xs text-cp-text-secondary px-1">切换账号</div>
          {accounts.filter(a => a.id !== currentAccount?.id).map(account => (
            <button
              key={account.id}
              onClick={() => handleSwitchAccount(account.id)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-cp-surface-hover text-left"
            >
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt={account.username} className="w-6 h-6 rounded-full" />
              ) : (
                <GitBranch className="w-6 h-6 text-cp-text-secondary" />
              )}
              <span className="text-sm text-cp-text">{account.username}</span>
            </button>
          ))}
        </div>
      )}

      {accounts.length > 0 && accounts.length < 5 && (
        <button
          onClick={handleConnect}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-cp-surface-hover text-sm text-cp-text-secondary"
        >
          <Plus className="w-4 h-4" />
          添加账号
        </button>
      )}
    </div>
  );
};
