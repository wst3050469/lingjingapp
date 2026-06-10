'use client';

import { usePathname, useSearchParams } from 'next/navigation';

interface Category {
  key: string;
  label: string;
}

export function CategoryFilter({ categories, activeCategory }: { categories: Category[]; activeCategory: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const isActive = cat.key === activeCategory;
        const params = new URLSearchParams(searchParams.toString());
        if (cat.key) {
          params.set('category', cat.key);
        } else {
          params.delete('category');
        }
        const href = `${pathname}?${params.toString()}`;

        return (
          <a
            key={cat.key}
            href={href}
            className={`rounded-lg px-4 py-2 text-sm transition-all ${
              isActive
                ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 shadow-neon-cyan'
                : 'bg-dark-600 text-gray-400 border border-dark-500/50 hover:text-gray-200 hover:border-dark-500'
            }`}
          >
            {cat.label}
          </a>
        );
      })}
    </div>
  );
}