import { useState } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { Button, Input } from '../ui';
import { clsx } from 'clsx';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('用户名和密码不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = mode === 'login'
        ? await window.electronAPI.auth.login(username, password)
        : await window.electronAPI.auth.register(username, password, email || undefined);

      if (result.success && result.user && result.token) {
        setAuth(result.user, result.token);
      } else {
        setError(result.error || '认证失败');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`连接错误: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-cp-text" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-cp-text">灵境AI</h1>
            <p className="text-neutral-400 text-sm mt-2">AI 编程助手</p>
          </div>

          <div className="flex mb-6 bg-neutral-900 rounded-lg p-1">
            <button
              type="button"
              className={clsx(
                'flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200',
                mode === 'login'
                  ? 'bg-primary-500 text-cp-text shadow-md'
                  : 'text-neutral-400 hover:text-cp-text'
              )}
              onClick={() => { setMode('login'); setError(''); }}
              aria-pressed={mode === 'login'}
            >
              登录
            </button>
            <button
              type="button"
              className={clsx(
                'flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200',
                mode === 'register'
                  ? 'bg-primary-500 text-cp-text shadow-md'
                  : 'text-neutral-400 hover:text-cp-text'
              )}
              onClick={() => { setMode('register'); setError(''); }}
              aria-pressed={mode === 'register'}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              disabled={loading}
              required
            />

            {mode === 'register' && (
              <Input
                type="email"
                label="邮箱（可选）"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                disabled={loading}
              />
            )}

            <Input
              type="password"
              label="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              disabled={loading}
              required
            />

            {error && (
              <div className="flex items-center gap-2 p-3 bg-error-dark/20 border border-error-dark rounded-md" role="alert">
                <svg className="w-4 h-4 text-error-dark shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-error-dark">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading}
            >
              {mode === 'login' ? '登录' : '创建账号'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-sm text-neutral-400 hover:text-primary-400 transition-colors"
            >
              {mode === 'login' ? '没有账号？立即注册' : '已有账号？立即登录'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-500 mt-6">
          继续使用即表示您同意服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
