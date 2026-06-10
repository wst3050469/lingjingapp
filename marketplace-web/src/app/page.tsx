import { fetchSkills, CATEGORIES } from '@/lib/api';
import { SkillCard } from '@/components/skill-card';
import { CategoryFilter } from '@/components/category-filter';

export default async function HomePage({ searchParams }: { searchParams: { category?: string; sort?: string } }) {
  const category = searchParams.category || '';
  const sort = searchParams.sort || 'install_count';
  const { skills, total } = await fetchSkills({ category, sort });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold neon-text text-neon-cyan">技能市场</h1>
        <p className="mt-2 text-gray-400">发现和安装 AI Agent 技能，增强你的灵境 IDE</p>
      </div>

      <CategoryFilter categories={CATEGORIES} activeCategory={category} />

      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-gray-500">共 {total} 个技能</span>
        <div className="flex gap-2">
          <a href={`/?category=${category}&sort=install_count`} className={`rounded-lg px-3 py-1 text-xs ${sort === 'install_count' ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-gray-500 hover:text-gray-300'}`}>
            最热门
          </a>
          <a href={`/?category=${category}&sort=rating`} className={`rounded-lg px-3 py-1 text-xs ${sort === 'rating' ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-gray-500 hover:text-gray-300'}`}>
            最高评分
          </a>
          <a href={`/?category=${category}&sort=created_at`} className={`rounded-lg px-3 py-1 text-xs ${sort === 'created_at' ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-gray-500 hover:text-gray-300'}`}>
            最新
          </a>
        </div>
      </div>

      {skills.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-lg text-gray-500">暂无技能</p>
          <p className="mt-2 text-sm text-gray-600">技能市场正在建设中，敬请期待</p>
        </div>
      )}
    </div>
  );
}