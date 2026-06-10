'use client';

import { useState } from 'react';
import { searchSkills, type Skill } from '@/lib/api';
import { SkillCard } from '@/components/skill-card';

export default function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    const skills = await searchSkills(keyword);
    setResults(skills);
    setLoading(false);
    setSearched(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold neon-text text-neon-cyan">搜索技能</h1>

      <div className="mt-6 flex gap-3">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="输入关键词搜索技能..."
          className="flex-1 rounded-lg border border-dark-500 bg-dark-700 px-4 py-3 text-gray-200 placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="glow-button rounded-lg px-6 py-3 font-medium text-dark-900 disabled:opacity-50"
        >
          {loading ? '搜索中...' : '搜索'}
        </button>
      </div>

      {searched && (
        <div className="mt-6">
          <p className="text-sm text-gray-500">找到 {results.length} 个结果</p>
          {results.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </div>
          ) : (
            <p className="mt-8 text-center text-gray-500">未找到匹配的技能</p>
          )}
        </div>
      )}
    </div>
  );
}