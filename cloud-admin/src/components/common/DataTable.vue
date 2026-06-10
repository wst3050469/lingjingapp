<template>
  <div class="data-table-wrapper">
    <!-- 批量操作栏 -->
    <div v-if="selectedKeys.length > 0" class="batch-bar">
      <span class="batch-count">已选 {{ selectedKeys.length }} 项</span>
      <a-button size="small" @click="$emit('batchDelete', selectedKeys)">批量删除</a-button>
      <a-button size="small" @click="selectedKeys = []">取消选择</a-button>
    </div>

    <!-- 工具栏：刷新 -->
    <div v-if="showRefresh" class="table-toolbar">
      <a-button type="text" size="small" @click="$emit('refresh')">
        <ReloadOutlined :spin="loading" /> 刷新
      </a-button>
    </div>

    <a-table
      :columns="enhancedColumns"
      :data-source="dataSource"
      :loading="loading"
      :row-key="rowKey"
      :pagination="showPagination ? paginationConfig : false"
      :row-selection="rowSelection"
      :row-class-name="striped ? stripeRow : undefined"
      :size="size"
      @change="handleChange"
    >
      <template #emptyText>
        <EmptyState description="暂无数据" />
      </template>
      <!-- pass through bodyCell slot -->
      <template v-for="(_, name) in $slots" #[name]="slotProps" :key="name">
        <slot :name="name" v-bind="slotProps" />
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TableColumnProps } from 'ant-design-vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import EmptyState from './EmptyState.vue';

const props = withDefaults(defineProps<{
  columns: TableColumnProps[];
  dataSource: any[];
  loading?: boolean;
  total?: number;
  rowKey?: string;
  selectable?: boolean;
  showPagination?: boolean;
  showRefresh?: boolean;
  striped?: boolean;
  size?: 'small' | 'middle' | 'default';
  page?: number;
  pageSize?: number;
}>(), {
  loading: false,
  total: 0,
  rowKey: 'id',
  selectable: false,
  showPagination: true,
  showRefresh: false,
  striped: false,
  size: 'default',
  page: 1,
  pageSize: 20,
});

const emit = defineEmits<{
  (e: 'pageChange', page: number, pageSize: number): void;
  (e: 'select', keys: string[]): void;
  (e: 'refresh'): void;
  (e: 'batchDelete', keys: string[]): void;
}>();

const selectedKeys = ref<string[]>([]);

// Enhance columns with sorter defaults from dataIndex
const enhancedColumns = computed(() =>
  props.columns.map((col) => ({
    ...col,
    sorter: col.sorter !== undefined ? col.sorter : undefined, // preserve explicit
    ellipsis: col.ellipsis !== undefined ? col.ellipsis : true,
  }))
);

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
    ? {
        selectedRowKeys: selectedKeys.value,
        onChange: (keys: string[], rows: any[]) => {
          selectedKeys.value = keys as string[];
          emit('select', rows.map((r: any) => r[props.rowKey]));
        },
      }
    : undefined
);

function stripeRow(record: any, index: number): string {
  return index % 2 === 1 ? 'table-row-striped' : '';
}

function handleChange(pagination: any, _filters: any, sorter: any) {
  if (pagination) {
    emit('pageChange', pagination.current, pagination.pageSize);
  }
}
</script>

<style scoped>
.data-table-wrapper {
  position: relative;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  margin-bottom: 8px;
  background: rgba(0, 245, 255, 0.08);
  border: 1px solid rgba(0, 245, 255, 0.2);
  border-radius: 8px;
  animation: batch-fade-in 0.2s ease;
}

.batch-count {
  font-size: 13px;
  color: var(--neon-cyan);
  flex: 1;
}

.table-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

@keyframes batch-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

<style>
/* Global (non-scoped) for table row stripes since antd renders rows */
.table-row-striped td {
  background: rgba(255, 255, 255, 0.02) !important;
}
</style>
