<template>
  <a-modal v-model:open="visible" title="全局搜索" :footer="null" class="global-search-modal" @afterOpenChange="handleOpen">
    <a-input
      ref="inputRef"
      v-model:value="keyword"
      placeholder="搜索设备、会话、技能、记忆..."
      allow-clear
      @input="handleSearch"
      size="large"
    />
    <div class="search-results" v-if="results.length">
      <div v-for="group in groupedResults" :key="group.label" class="result-group">
        <div class="group-label">{{ group.label }}</div>
        <div v-for="item in group.items" :key="item.id" class="result-item" @click="handleSelect(item)">
          {{ item.name }}
        </div>
      </div>
    </div>
    <div class="search-empty" v-else-if="keyword">无搜索结果</div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { get } from '@/api/index';

const visible = ref(false);
const keyword = ref('');
const inputRef = ref();
const router = useRouter();

interface SearchResult { id: string; name: string; type: string; route: string; }
const results = ref<SearchResult[]>([]);

const groupedResults = computed(() => {
  const groups: Record<string, SearchResult[]> = {};
  for (const r of results.value) {
    (groups[r.type] ??= []).push(r);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
});

async function handleSearch() {
  if (!keyword.value.trim()) { results.value = []; return; }
  const q = keyword.value.trim();
  try {
    const [devices, sessions, skills, memories] = await Promise.allSettled([
      get<any[]>('/devices', { search: q }),
      get<any[]>('/sessions', { search: q }),
      get<any[]>('/skills', { search: q }),
      get<any[]>('/memories', { search: q }),
    ]);
    const all: SearchResult[] = [];
    if (devices.status === 'fulfilled') for (const d of (devices.value as any[])) all.push({ id: d.id, name: d.device_name ?? d.id, type: '设备', route: '/devices' });
    if (sessions.status === 'fulfilled') for (const s of (sessions.value as any[])) all.push({ id: s.session_id ?? s.id, name: s.task_title ?? s.id, type: '会话', route: '/sessions' });
    if (skills.status === 'fulfilled') for (const sk of (skills.value as any[])) all.push({ id: sk.id, name: sk.name, type: '技能', route: '/skills' });
    if (memories.status === 'fulfilled') for (const m of (memories.value as any[])) all.push({ id: m.id, name: m.title ?? m.id, type: '记忆', route: '/memories' });
    results.value = all.slice(0, 20);
  } catch { results.value = []; }
}

function handleSelect(item: SearchResult) {
  visible.value = false;
  router.push(item.route);
}

function handleOpen(isOpen: boolean) {
  if (isOpen) inputRef.value?.focus();
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    visible.value = true;
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<style scoped>
.search-results { max-height: 400px; overflow-y: auto; margin-top: 16px; }
.result-group { margin-bottom: 12px; }
.group-label { color: var(--neon-cyan); font-size: 12px; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; }
.result-item { padding: 8px 12px; cursor: pointer; border-radius: 6px; transition: background 0.2s; }
.result-item:hover { background: rgba(0, 245, 255, 0.08); }
.search-empty { color: var(--text-secondary); text-align: center; padding: 24px; }
</style>