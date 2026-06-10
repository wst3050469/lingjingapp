import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '灵境技能市场 - Lingjing Marketplace',
  description: '发现和安装 AI Agent 技能，增强你的灵境 IDE',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-dark-900 text-gray-200 antialiased">
        <div className="relative min-h-screen">
          <nav className="sticky top-0 z-50 border-b border-dark-500/50 bg-dark-900/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-neon-cyan to-neon-blue">
                  <span className="text-sm font-bold text-dark-900">灵</span>
                </div>
                <span className="text-lg font-semibold neon-text text-neon-cyan">技能市场</span>
              </div>
              <div className="flex items-center gap-4">
                <a href="/" className="text-sm text-gray-400 hover:text-neon-cyan transition-colors">浏览</a>
                <a href="/search" className="text-sm text-gray-400 hover:text-neon-cyan transition-colors">搜索</a>
              </div>
            </div>
          </nav>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}