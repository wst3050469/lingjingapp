import type { Skill } from '@/lib/api';

export function SkillCard({ skill }: { skill: Skill }) {
  return (
    <a
      href={`/skills/${skill.id}`}
      className="card-glow group block rounded-xl border border-dark-500/50 bg-dark-700 p-5 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-blue/20 border border-neon-cyan/20">
          <span className="text-lg font-bold text-neon-cyan">{skill.name.charAt(0)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-gray-100 group-hover:text-neon-cyan transition-colors">
            {skill.name}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">by {skill.author} · v{skill.version}</p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-gray-400">{skill.description}</p>

      <div className="mt-3 flex items-center gap-3">
        <span className="rounded-full bg-neon-cyan/10 px-2 py-0.5 text-xs text-neon-cyan">
          {skill.category}
        </span>
        <span className="text-xs text-gray-500">⭐ {skill.rating.toFixed(1)}</span>
        <span className="text-xs text-gray-500">{skill.install_count} 次安装</span>
      </div>

      {skill.security_status === 'approved' && (
        <div className="mt-2 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
          <span className="text-xs text-green-400">安全审核通过</span>
        </div>
      )}
    </a>
  );
}