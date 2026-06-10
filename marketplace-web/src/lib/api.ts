const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://ide.zhejiangjinmo.com/api/v1/marketplace';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  version: string;
  icon_url: string;
  rating: number;
  install_count: number;
  security_status: string;
  tags: string[];
}

export async function fetchSkills(params?: { category?: string; sort?: string; page?: number }): Promise<{ skills: Skill[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.page) searchParams.set('page', String(params.page));

  try {
    const res = await fetch(`${API_BASE}/skills?${searchParams}`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { skills: [], total: 0 };
  }
}

export async function searchSkills(keyword: string): Promise<Skill[]> {
  try {
    const res = await fetch(`${API_BASE}/skills/search?q=${encodeURIComponent(keyword)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.skills ?? [];
  } catch {
    return [];
  }
}

export async function fetchSkillDetail(skillId: string): Promise<Skill | null> {
  try {
    const res = await fetch(`${API_BASE}/skills/${skillId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

const CATEGORIES = [
  { key: '', label: '全部' },
  { key: 'code_generation', label: '代码生成' },
  { key: 'testing', label: '测试' },
  { key: 'review', label: '审查' },
  { key: 'deployment', label: '部署' },
  { key: 'hardware_design', label: '硬件设计' },
  { key: 'custom', label: '自定义' },
];

export { CATEGORIES };