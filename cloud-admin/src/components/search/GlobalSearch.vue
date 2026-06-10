<template>
  <a-modal
    v-model:open="visible"
    title="全局搜索"
    :footer="null"
    class="global-search-modal"
    :width="560"
    @afterOpenChange="handleOpen"
  >
    <a-input
      ref="inputRef"
      v-model:value="keyword"
      placeholder="搜索设备、会话、技能、记忆..."
      allow-clear
      @input="handleSearch"
      size="large"
    >
      <template #prefix><SearchOutlined /></template>
    </a-input>

    <!-- Search results -->
    <div class="search-results" v-if="keyword && results.length">
      <div v-for="group in groupedResults" :key="group.label" class="result-group">
        <div class="group-label">{{ group.label }}</div>
        <div
          v-for="item in group.items"
          :key="item.id"
          class="result-item"
          @click="handleSelect(item)"
        >
          <span class="result-name">{{ item.name }}</span>
          <span class="result-hint">↗</span>
        </div>
      </div>
    </div>

    <!-- No results -->
    <div class="search-empty" v-else-if="keyword">无搜索结果</div>

    <!-- History (when no keyword) -->
    <div class="search-history" v-if="!keyword && history.length">
      <div class="history-header">
        <span class="group-label">最近搜索</span>
        <a-button type="link" size="small" @click="clearHistory" class="clear-btn">清除</a-button>
      </div>
      <a-tag
        v-for="h in history"
        :key="h"
        class="history-tag"
        @click="keyword = h; handleSearch()"
      >
        {{ h }}
      </a-tag>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { SearchOutlined } from '@ant-design/icons-vue';
import { get } from '@/api/index';

const STORAGE_KEY = 'admin_search_history';

const visible = ref(false);
const keyword = ref('');
const inputRef = ref();
const router = useRouter();

interface SearchResult { id: string; name: string; type: string; route: string; }
const results = ref<SearchResult[]>([]);

// --- Search History ---
const history = ref<string[]>(loadHistory());

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}
function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value.slice(0, 10)));
}
function addHistory(q: string) {
  history.value = [q, ...history.value.filter((h) => h !== q)].slice(0, 10);
  saveHistory();
}
function clearHistory() {
  history.value = [];
  saveHistory();
}

// --- Grouped Results ---
const groupedResults = computed(() => {
  const groups: Record<string, SearchResult[]> = {};
  for (const r of results.value) {
    (groups[r.type] ??= []).push(r);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
});

// --- Debounced Search ---
let searchTimer: ReturnType<typeof setTimeout> | null = null;

async function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  const q = keyword.value.trim();
  if (!q) { results.value = []; return; }

  searchTimer = setTimeout(async () => {
    try {
      const [devices, sessions, skills, memories] = await Promise.allSettled([
        get<any[]>('/devices', { search: q }),
        get<any[]>('/sessions', { search: q }),
        get<any[]>('/skills', { search: q }),
        get<any[]>('/memories', { search: q }),
      ]);
      const all: SearchResult[] = [];
      if (devices.status === 'fulfilled')
        for (const d of (devices.value as any[]))
          all.push({ id: d.id, name: d.device_name ?? d.id, type: '设备', route: '/devices' });
      if (sessions.status === 'fulfilled')
        for (const s of (sessions.value as any[]))
          all.push({ id: s.session_id ?? s.id, name: s.task_title ?? s.id, type: '会话', route: '/sessions' });
      if (skills.status === 'fulfilled')
        for (const sk of (skills.value as any[]))
          all.push({ id: sk.id, name: sk.name, type: '技能', route: '/skills' });
      if (memories.status === 'fulfilled')
        for (const m of (memories.value as any[]))
          all.push({ id: m.id, name: m.title ?? m.id, type: '记忆', route: '/memories' });
      results.value = all.slice(0, 20);
    } catch {
      results.value = [];
    }
  }, 300);
}

function handleSelect(item: SearchResult) {
  addHistory(keyword.value.trim());
  visible.value = false;
  keyword.value = '';
  router.push(item.route);
}

function handleOpen(isOpen: boolean) {
  if (isOpen) {
    setTimeout(() => inputRef.value?.focus(), 100);
    keyword.value = '';
    results.value = [];
  }
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    visible.value = true;
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<style scoped>
.search-results {
  max-height: 400px;
  overflow-y: auto;
  margin-top: 16px;
}

.result-group {
  margin-bottom: 12px;
}

.group-label {
  color: var(--neon-cyan);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
}

.result-item:hover {
  background: rgba(0, 245, 255, 0.08);
}

.result-name {
  color: var(--text-primary);
}

.result-hint {
  color: var(--text-tertiary);
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.15s;
}

.result-item:hover .result-hint {
  opacity: 1;
}

.search-empty {
  color: var(--text-secondary);
  text-align: center;
  padding: 24px;
}

/* History */
.search-history {
  margin-top: 16px;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.clear-btn {
  font-size: 12px;
  color: var(--text-tertiary);
}

.history-tag {
  cursor: pointer;
  margin: 0 6px 6px 0;
  background: rgba(255, 255, 255, 0.03);
  border-color: var(--dark-500);
  color: var(--text-secondary);
  transition: all 0.2s;
}

.history-tag:hover {
  color: var(--neon-cyan);
  border-color: rgba(0, 245, 255, 0.3);
  background: rgba(0, 245, 255, 0.05);
}
</style>
