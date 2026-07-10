<template>
  <div class="page">
    <h2 class="page-title">审计日志</h2>

    <!-- 筛选栏 -->
    <a-card size="small" style="margin-bottom:16px">
      <a-row :gutter="16" type="flex" align="middle">
        <a-col :span="6">
          <a-input v-model:value="filters.admin_name" placeholder="搜索管理员" allowClear @pressEnter="doSearch" />
        </a-col>
        <a-col :span="6">
          <a-select v-model:value="filters.action" placeholder="操作类型" allowClear style="width:100%" @change="doSearch">
            <a-select-option value="管理员登录">管理员登录</a-select-option>
            <a-select-option value="查看">查看</a-select-option>
            <a-select-option value="创建">创建</a-select-option>
            <a-select-option value="更新">更新</a-select-option>
            <a-select-option value="删除">删除</a-select-option>
            <a-select-option value="审核">审核</a-select-option>
            <a-select-option value="发布">发布</a-select-option>
            <a-select-option value="上传">上传</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="5">
          <a-date-picker v-model:value="filters.date_from" placeholder="开始日期" style="width:100%" @change="doSearch" />
        </a-col>
        <a-col :span="5">
          <a-date-picker v-model:value="filters.date_to" placeholder="结束日期" style="width:100%" @change="doSearch" />
        </a-col>
        <a-col :span="2">
          <a-button @click="clearFilters" size="small">重置</a-button>
        </a-col>
      </a-row>
    </a-card>

    <a-table
      :dataSource="store.list"
      :columns="columns"
      rowKey="id"
      :loading="store.loading"
      size="small"
      :pagination="{
        current: store.currentPage,
        pageSize: store.pageSize,
        total: store.total,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: (total: number) => `共 ${total} 条`,
        onChange: (page: number) => { store.setPage(page); doSearch(); },
        onShowSizeChange: (_c: number, size: number) => { store.setPageSize(size); doSearch(); },
      }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'time'">{{ formatTime(record.created_at) }}</template>
      </template>
    </a-table>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useLogStore } from '@/stores/logs';

const store = useLogStore();

const filters = reactive({
  admin_name: undefined as string | undefined,
  action: undefined as string | undefined,
  date_from: undefined as any,
  date_to: undefined as any,
});

const columns = [
  { title: '管理员', dataIndex: 'admin_name', key: 'admin_name' },
  { title: '操作', dataIndex: 'action', key: 'action' },
  { title: '目标类型', dataIndex: 'target_type', key: 'target_type' },
  { title: '目标ID', dataIndex: 'target_id', key: 'target_id' },
  { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
  { title: '时间', key: 'time', width: 180 },
];

onMounted(() => doSearch());

function buildParams() {
  const params: Record<string, any> = {
    page: store.currentPage,
    page_size: store.pageSize,
  };
  if (filters.admin_name) params.admin_name = filters.admin_name;
  if (filters.action) params.action = filters.action;
  if (filters.date_from) params.date_from = filters.date_from.format?.('YYYY-MM-DD') || filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to.format?.('YYYY-MM-DD') || filters.date_to;
  return params;
}

function doSearch() {
  store.loadList(buildParams());
}

function clearFilters() {
  filters.admin_name = undefined;
  filters.action = undefined;
  filters.date_from = undefined;
  filters.date_to = undefined;
  store.currentPage = 1;
  doSearch();
}

function formatTime(t: string) {
  if (!t) return '';
  return new Date(t).toLocaleString('zh-CN');
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
</style>
