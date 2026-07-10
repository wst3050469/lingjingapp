import { ref, computed, onMounted, onUnmounted } from 'vue';

export type SidebarBreakpoint = 'full' | 'compact' | 'hidden';

export function useSidebar() {
  const collapsed = ref(false);
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
    return 180;
  });

  function toggleMain(): void {
    collapsed.value = !collapsed.value;
  }

  function updateWidth(): void {
    width.value = window.innerWidth;
  }

  onMounted(() => {
    window.addEventListener('resize', updateWidth);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateWidth);
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
