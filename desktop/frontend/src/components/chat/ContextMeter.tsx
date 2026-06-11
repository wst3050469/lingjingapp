// Context usage meter with compact chat button

interface ContextMeterProps {
  cumulativeTokens: number;
  maxContextTokens: number;
  isCompacting: boolean;
  canCompact: boolean;
  onCompact: () => void;
}

function formatTokens(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
  }
  return String(n);
}

export function ContextMeter({
  cumulativeTokens,
  maxContextTokens,
  isCompacting,
  canCompact,
  onCompact,
}: ContextMeterProps) {
  const percent = Math.min(100, (cumulativeTokens / maxContextTokens) * 100);

  const barColor =
    percent < 60
      ? 'bg-emerald-500'
      : percent < 85
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <span className="text-[9px] text-white/80 shrink-0">上下文</span>

      {/* Progress bar */}
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden min-w-[40px]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Token count */}
      <span className="text-[9px] text-white/70 shrink-0 tabular-nums">
        {formatTokens(cumulativeTokens)} / {formatTokens(maxContextTokens)}
      </span>

      {/* Compact button */}
      <button
        onClick={onCompact}
        disabled={!canCompact || isCompacting}
        className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] transition-colors ${
          !canCompact || isCompacting
            ? 'text-white/30 cursor-not-allowed'
            : percent >= 60
              ? 'text-cp-accent hover:bg-cp-accent/20 animate-pulse'
              : 'text-white/70 hover:text-white hover:bg-white/5'
        }`}
        title={!canCompact ? '对话内容太少，暂不需要精简' : '精简对话，压缩上下文'}
      >
        {isCompacting ? (
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" />
            </svg>
            精简中
          </span>
        ) : (
          '精简对话'
        )}
      </button>
    </div>
  );
}
