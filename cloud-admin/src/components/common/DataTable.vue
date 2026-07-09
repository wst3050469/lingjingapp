<template>
  <a-table
    :columns="columns"
    :data-source="dataSource"
    :loading="loading"
    :row-key="rowKey"
    :pagination="paginationConfig"
    :row-selection="rowSelection"
    @change="handleChange"
  >
    <template #emptyText>
      <EmptyState description="暂无数据" />
    </template>
  </a-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TableProps, TableColumnProps } from 'ant-design-vue';
import EmptyState from './EmptyState.vue';

const props = withDefaults(defineProps<{
  columns: TableColumnProps[];
  dataSource: any[];
  loading?: boolean;
  total?: number;
  rowKey?: string;
  selectable?: boolean;
  page?: number;
  pageSize?: number;
}>(), { loading: false, total: 0, rowKey: 'id', selectable: false, page: 1, pageSize: 20 });

const emit = defineEmits<{
  (e: 'pageChange', page: number, pageSize: number): void;
  (e: 'select', keys: string[]): void;
}>();

const paginationConfig = computed(() => ({
  current: props.page,
  pageSize: props.pageSize,
  total: props.total,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
}));

const rowSelection = computed(() =>
  props.selectable
    ? { onChange: (_: string[], rows: any[]) => emit('select', rows.map((r) => r[props.rowKey])) }
    : undefined
);

function handleChange(pagination: any) {
  emit('pageChange', pagination.current, pagination.pageSize);
}
</script>