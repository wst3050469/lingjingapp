import { ref, onMounted, onUnmounted } from 'vue';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export function useResponsive() {
  const breakpoint = ref<Breakpoint>('desktop');
  const width = ref(window.innerWidth);

  function update(): void {
    width.value = window.innerWidth;
    if (width.value >= 1200) {
      breakpoint.value = 'desktop';
    } else if (width.value >= 768) {
      breakpoint.value = 'tablet';
    } else {
      breakpoint.value = 'mobile';
    }
  }

  onMounted(() => {
    update();
    window.addEventListener('resize', update);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', update);
  });

  const isMobile = ref(false);
  const isTablet = ref(false);
  const isDesktop = ref(false);

  function syncFlags(): void {
    isMobile.value = breakpoint.value === 'mobile';
    isTablet.value = breakpoint.value === 'tablet';
    isDesktop.value = breakpoint.value === 'desktop';
  }

  onMounted(syncFlags);

  return { breakpoint, width, isMobile, isTablet, isDesktop };
}