import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ExpertResultCardProps {
  expertType: string;
  title: string;
  result: string;
  isError?: boolean;
}

export function ExpertResultCard({ title, result, isError }: ExpertResultCardProps) {
  const [expanded, setExpanded] = useState(true);
  const isLong = result.length > 500;
  const displayResult = expanded ? result : result.slice(0, 500) + '...';

  return (
    <div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-indigo-400 hover:text-indigo-300 mb-1"
        >
          {expanded ? '\u6536\u8d77' : '\u5c55\u5f00\u5168\u90e8'}
        </button>
      )}
      <div className={`prose prose-invert prose-xs max-w-none max-h-64 overflow-y-auto
        prose-code:text-cp-success prose-code:bg-black/30 prose-code:px-1 prose-code:rounded
        prose-pre:bg-cp-editor prose-pre:border prose-pre:border-cp-border prose-pre:rounded
        ${isError ? 'text-red-300' : 'text-cp-text-dim'}`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {displayResult}
        </ReactMarkdown>
      </div>
    </div>
  );
}
