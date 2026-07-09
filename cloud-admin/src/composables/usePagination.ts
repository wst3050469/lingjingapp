import { ref, computed } from 'vue';

export function usePagination(defaultPageSize = 20) {
  const page = ref(1);
  const pageSize = ref(defaultPageSize);
  const total = ref(0);

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1);

  function changePage(newPage: number): void {
    page.value = Math.max(1, Math.min(newPage, totalPages.value));
  }

  function changePageSize(newSize: number): void {
    pageSize.value = newSize;
    page.value = 1;
  }

  function setTotal(count: number): void {
    total.value = count;
  }

  function reset(): void {
    page.value = 1;
  }

  const params = computed(() => ({
    page: page.value,
    limit: pageSize.value,
  }));

  return { page, pageSize, total, totalPages, params, changePage, changePageSize, setTotal, reset };
}