import { ref, computed, onMounted, onUnmounted } from 'vue';

const STORAGE_KEY = 'lingjing_sidebar_collapsed';

export type SidebarBreakpoint = 'full' | 'compact' | 'hidden';

export function useSidebar() {
  // 从 localStorage 恢复收起状态
  const collapsed = ref(localStorage.getItem(STORAGE_KEY) === 'true');
  const width = ref(window.innerWidth);

  const breakpoint = computed<SidebarBreakpoint>(() => {
    if (width.value >= 1440) return 'full';
    if (width.value >= 768) return 'compact';
    return 'hidden';
  });

  const isMobile = computed(() => width.value < 768);
  const isTablet = computed(() => width.value >= 768 && width.value < 1200);
  const isDesktop = computed(() => width.value >= 1200);

  // 在紧凑模式下自动收起侧边栏
  const effectiveCollapsed = computed(() => {
    if (breakpoint.value === 'hidden') return true;
    if (breakpoint.value === 'compact') return true;
    return collapsed.value;
  });

  const mainWidth = computed(() => {
    if (breakpoint.value === 'hidden') return 0;
    if (effectiveCollapsed.value) return 64;
    return 210;
  });

  function toggleMain(): void {
    collapsed.value = !collapsed.value;
    localStorage.setItem(STORAGE_KEY, String(collapsed.value));
  }

  function updateWidth(): void {
    width.value = window.innerWidth;
  }

  // 其他标签页修改 localStorage 时同步状态
  function handleStorageChange(e: StorageEvent): void {
    if (e.key === STORAGE_KEY) {
      collapsed.value = e.newValue === 'true';
    }
  }

  onMounted(() => {
    window.addEventListener('resize', updateWidth);
    window.addEventListener('storage', handleStorageChange);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateWidth);
    window.removeEventListener('storage', handleStorageChange);
  });

  return {
    collapsed,
    effectiveCollapsed,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    mainWidth,
    toggleMain,
  };
}
