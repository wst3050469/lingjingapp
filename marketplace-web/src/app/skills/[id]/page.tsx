import { fetchSkillDetail, type Skill } from '@/lib/api';
import { notFound } from 'next/navigation';

export default async function SkillDetailPage({ params }: { params: { id: string } }) {
  const skill = await fetchSkillDetail(params.id);
  if (!skill) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-dark-500/50 bg-dark-700 p-6 neon-border">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-blue/20 border border-neon-cyan/20">
            <span className="text-2xl font-bold text-neon-cyan">{skill.name.charAt(0)}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-100">{skill.name}</h1>
            <p className="mt-1 text-sm text-gray-400">by {skill.author} · v{skill.version}</p>
          </div>
        </div>

        <p className="mt-4 text-gray-300">{skill.description}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-neon-cyan/10 px-3 py-1 text-xs text-neon-cyan">{skill.category}</span>
          {skill.tags?.map((tag) => (
            <span key={tag} className="rounded-full bg-dark-500 px-3 py-1 text-xs text-gray-400">{tag}</span>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-dark-600 p-3 text-center">
            <p className="text-lg font-semibold text-neon-cyan">{skill.rating.toFixed(1)}</p>
            <p className="text-xs text-gray-500">评分</p>
          </div>
          <div className="rounded-lg bg-dark-600 p-3 text-center">
            <p className="text-lg font-semibold text-neon-blue">{skill.install_count}</p>
            <p className="text-xs text-gray-500">安装数</p>
          </div>
          <div className="rounded-lg bg-dark-600 p-3 text-center">
            <p className={`text-lg font-semibold ${skill.security_status === 'approved' ? 'text-green-400' : 'text-yellow-400'}`}>
              {skill.security_status === 'approved' ? '已审核' : '待审核'}
            </p>
            <p className="text-xs text-gray-500">安全状态</p>
          </div>
        </div>

        <div className="mt-6">
          <button className="glow-button w-full rounded-lg py-3 text-center font-semibold text-dark-900">
            在灵境 IDE 中安装
          </button>
          <p className="mt-2 text-center text-xs text-gray-500">将通过 URL Scheme 打开灵境 IDE</p>
        </div>
      </div>
    </div>
  );
}