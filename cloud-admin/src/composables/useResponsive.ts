import { ref, computed, onMounted, onUnmounted } from 'vue';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export function useResponsive() {
  const width = ref(window.innerWidth);

  const breakpoint = computed<Breakpoint>(() => {
    if (width.value < 480) return 'xs';
    if (width.value < 768) return 'sm';
    if (width.value < 1024) return 'md';
    if (width.value < 1280) return 'lg';
    return 'xl';
  });

  const isMobile = computed(() => breakpoint.value === 'xs' || breakpoint.value === 'sm');
  const isTablet = computed(() => breakpoint.value === 'md');
  const isDesktop = computed(() => breakpoint.value === 'lg' || breakpoint.value === 'xl');

  function update(): void {
    width.value = window.innerWidth;
  }

  onMounted(() => window.addEventListener('resize', update));
  onUnmounted(() => window.removeEventListener('resize', update));

  return { breakpoint, width, isMobile, isTablet, isDesktop };
}
