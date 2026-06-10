interface RecommendationCardsProps {
  recommendations: string[];
  onSelect: (text: string) => void;
}

export function RecommendationCards({ recommendations, onSelect }: RecommendationCardsProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-[10px] text-cp-text-dim/40 uppercase tracking-wider">建议操作</p>
      {recommendations.map((rec, i) => (
        <button
          key={i}
          onClick={() => onSelect(rec)}
          className="w-full text-left px-2.5 py-1.5 rounded-md border border-cp-border/40 bg-white/[0.02]
            text-[11px] text-cp-text-dim hover:text-white hover:bg-white/[0.05] hover:border-cp-accent/30
            transition-all"
        >
          {rec}
        </button>
      ))}
    </div>
  );
}

/** Generate heuristic recommendations based on last assistant response */
export function generateRecommendations(lastContent: string): string[] {
  const recs: string[] = [];
  const lower = lastContent.toLowerCase();

  if (lower.includes('```') || lower.includes('function') || lower.includes('class ')) {
    recs.push('运行这段代码');
    recs.push('为这段代码写测试');
    recs.push('审查并优化这段代码');
  } else if (lower.includes('file') || lower.includes('文件') || lower.includes('.ts') || lower.includes('.tsx')) {
    recs.push('查看相关文件');
    recs.push('继续修改');
  } else if (lower.includes('error') || lower.includes('错误') || lower.includes('bug')) {
    recs.push('修复这个问题');
    recs.push('解释根本原因');
  }

  // Always add default suggestions up to 3
  const defaults = ['继续深入', '总结一下', '换个思路'];
  for (const d of defaults) {
    if (recs.length >= 3) break;
    if (!recs.includes(d)) recs.push(d);
  }

  return recs.slice(0, 3);
}
