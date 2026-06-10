export interface ExpertMeta {
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}

const EXPERT_META: Record<string, ExpertMeta> = {
  'frontend-expert': { emoji: '\u{1F3A8}', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', label: '\u524d\u7aef\u4e13\u5bb6' },
  'backend-expert': { emoji: '\u{1F527}', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', label: '\u540e\u7aef\u4e13\u5bb6' },
  'qa-expert': { emoji: '\u{1F9EA}', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', label: 'QA\u4e13\u5bb6' },
  'code-review-expert': { emoji: '\u{1F50D}', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', label: '\u4ee3\u7801\u5ba1\u67e5' },
  'research-expert': { emoji: '\u{1F4DA}', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', label: '\u7814\u7a76\u4e13\u5bb6' },
  'devops-expert': { emoji: '\u{1F680}', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30', label: 'DevOps\u4e13\u5bb6' },
  'ux-design-expert': { emoji: '\u{1F3AF}', color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/30', label: 'UX\u8bbe\u8ba1' },
};

const DEFAULT_META: ExpertMeta = {
  emoji: '\u{1F916}',
  color: 'text-cp-text-dim',
  bgColor: 'bg-white/5',
  borderColor: 'border-cp-border/50',
  label: '\u4e13\u5bb6',
};

export function getExpertMeta(expertType: string): ExpertMeta {
  return EXPERT_META[expertType] ?? { ...DEFAULT_META, label: expertType };
}

export function getAllExpertTypes(): string[] {
  return Object.keys(EXPERT_META);
}
