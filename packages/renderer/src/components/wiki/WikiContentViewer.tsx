// WikiContentViewer - renders markdown content for the selected wiki module

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useWikiStore } from '../../stores/wiki-store';

export function WikiContentViewer() {
  const { selectedModule, content, status, workspaceMissing, modelMissing, checkingPrerequisites } = useWikiStore();
  const hasWiki = status?.hasWiki ?? false;

  // Empty state: no wiki generated yet
  if (!hasWiki) {
    // Check prerequisites and show specific guidance
    if (checkingPrerequisites) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <span className="text-xs text-cp-text-dim/40">检查前置条件...</span>
        </div>
      );
    }

    if (workspaceMissing) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m-3-18h3m-1.5 6h.008v.008h-.008V9z" />
            </svg>
          </div>
          <h3 className="text-sm text-cp-text font-medium mb-2">请先打开工作目录</h3>
          <p className="text-xs text-cp-text-dim/50 max-w-[260px] leading-relaxed">
            Repo Wiki 需要打开一个代码工作目录。请在左侧活动栏点击「打开文件夹」选择一个项目目录，然后重新打开 Wiki。
          </p>
        </div>
      );
    }

    if (modelMissing) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <h3 className="text-sm text-cp-text font-medium mb-2">请先配置 AI 模型</h3>
          <p className="text-xs text-cp-text-dim/50 max-w-[260px] leading-relaxed">
            生成 Wiki 文档需要配置 AI 模型。请点击左下角状态栏的模型选择器，选择一个模型并配置 API Key。
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-cp-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h3 className="text-sm text-cp-text font-medium mb-2">尚未生成 Wiki</h3>
        <p className="text-xs text-cp-text-dim/50 max-w-[260px] leading-relaxed">
          点击工具栏中的「生成 Wiki」按钮，自动分析代码库并生成结构化的项目文档。
        </p>
      </div>
    );
  }

  // No module selected
  if (!selectedModule) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <p className="text-xs text-cp-text-dim/40">从左侧目录选择一个模块查看文档</p>
      </div>
    );
  }

  // Loading or empty content
  if (!content) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs text-cp-text-dim/40">加载中...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <article className="wiki-content prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            h1: ({ children }) => <h1 className="text-xl font-bold text-cp-text mb-4 pb-2 border-b border-cp-border/30">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-semibold text-cp-text mt-6 mb-3">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-medium text-cp-text mt-4 mb-2">{children}</h3>,
            p: ({ children }) => <p className="text-sm text-cp-text-dim leading-relaxed mb-3">{children}</p>,
            ul: ({ children }) => <ul className="text-sm text-cp-text-dim list-disc pl-5 mb-3 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="text-sm text-cp-text-dim list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            code: ({ className, children, ...props }) => {
              const isInline = !className;
              if (isInline) {
                return <code className="text-xs bg-white/10 text-cp-accent px-1.5 py-0.5 rounded" {...props}>{children}</code>;
              }
              return <code className={`${className} text-xs`} {...props}>{children}</code>;
            },
            pre: ({ children }) => <pre className="bg-cp-editor border border-cp-border/30 rounded-lg p-3 mb-3 overflow-x-auto">{children}</pre>,
            table: ({ children }) => (
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm border-collapse">{children}</table>
              </div>
            ),
            th: ({ children }) => <th className="text-left px-3 py-1.5 text-xs font-medium text-cp-text-dim border-b border-cp-border/30 bg-white/[0.03]">{children}</th>,
            td: ({ children }) => <td className="px-3 py-1.5 text-xs text-cp-text-dim border-b border-cp-border/10">{children}</td>,
            blockquote: ({ children }) => <blockquote className="border-l-2 border-cp-accent/30 pl-4 my-3 text-cp-text-dim/70">{children}</blockquote>,
            strong: ({ children }) => <strong className="text-cp-text font-semibold">{children}</strong>,
            a: ({ children, href }) => <a href={href} className="text-cp-accent hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
