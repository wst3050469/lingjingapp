<template>
  <div class="page">
    <h2 class="page-title">会话管理</h2>
    <!-- 搜索栏 -->
    <a-card size="small" style="margin-bottom:16px">
      <a-row :gutter="16" type="flex" align="middle">
        <a-col :span="12">
          <a-input-search v-model:value="keyword" placeholder="搜索标题、邀请码或消息内容" enter-button @search="doSearch" allowClear />
        </a-col>
        <a-col :span="12">
          <span style="line-height:32px;color:var(--text-secondary)">
            共 <strong>{{ store.total }}</strong> 条对话，第 {{ store.currentPage }}/{{ totalPages }} 页
          </span>
        </a-col>
      </a-row>
    </a-card>

    <!-- 工具栏 -->
    <div class="toolbar">
      <span></span>
      <a-button @click="handleExport" :disabled="store.list.length === 0" size="small">
        <template #icon><DownloadOutlined /></template>
        导出 CSV
      </a-button>
    </div>

    <a-table
      :dataSource="store.list"
      :columns="columns"
      rowKey="session_id"
      :loading="store.loading"
      size="small"
      :pagination="{
        current: store.currentPage,
        pageSize: store.pageSize,
        total: store.total,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50'],
        onChange: (page: number) => store.setPage(page),
        onShowSizeChange: (_c: number, size: number) => store.setPageSize(size),
      }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'time'">{{ formatTime(record.created_at) }}</template>
        <template v-if="column.key === 'msg_count'">
          <a-tag>{{ record.message_count || 0 }}</a-tag>
        </template>
        <template v-if="column.key === 'cost'">
          {{ record.total_cost ? '¥' + record.total_cost.toFixed(4) : '-' }}
        </template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="viewDetail(record)">查看</a-button>
        </template>
      </template>
    </a-table>

    <!-- 会话详情抽屉 -->
    <a-drawer
      v-model:open="detailOpen"
      title="会话详情"
      placement="right"
      width="600px"
    >
      <template v-if="detailSession">
        <p><strong>会话ID：</strong>{{ detailSession.session_id }}</p>
        <p><strong>标题：</strong>{{ detailSession.title || '新对话' }}</p>
        <p><strong>邀请码：</strong>{{ detailSession.invite_code || '-' }}</p>
        <p><strong>消息数：</strong>{{ detailSession.message_count || 0 }}</p>
        <p><strong>Token数：</strong>{{ detailSession.total_tokens || 0 }}</p>
        <p><strong>费用：</strong>¥{{ detailSession.total_cost || 0 }}</p>
        <p><strong>创建时间：</strong>{{ formatTime(detailSession.created_at) }}</p>
        <a-divider />
        <h4>最后用户消息</h4>
        <p style="background:var(--dark-700);padding:8px;border-radius:4px;white-space:pre-wrap">{{ detailSession.last_user_msg || '（无）' }}</p>
        <h4>最后AI回复</h4>
        <p style="background:var(--dark-700);padding:8px;border-radius:4px;white-space:pre-wrap">{{ detailSession.last_ai_msg || '（无）' }}</p>
      </template>
    </a-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { DownloadOutlined } from '@ant-design/icons-vue';
import { useSessionStore } from '@/stores/sessions';
import { exportToCsv } from '@/utils/export';

const store = useSessionStore();
const keyword = ref('');
const detailOpen = ref(false);
const detailSession = ref<any>(null);

const totalPages = computed(() => Math.ceil((store.total || 0) / store.pageSize));

const columns = [
  { title: '会话ID', dataIndex: 'session_id', key: 'session_id', ellipsis: true, width: 120 },
  { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '邀请码', dataIndex: 'invite_code', key: 'invite_code', width: 100 },
  { title: '消息数', key: 'msg_count', width: 70 },
  { title: '费用', key: 'cost', width: 100 },
  { title: '创建时间', key: 'time', width: 180 },
  { title: '操作', key: 'action', width: 70 },
];

onMounted(() => store.loadList());

function doSearch() {
  store.search(keyword.value);
}

function viewDetail(record: any) {
  detailSession.value = record;
  detailOpen.value = true;
}

function formatTime(t: string) {
  if (!t) return '';
  return new Date(t).toLocaleString('zh-CN');
}

function handleExport() {
  exportToCsv('会话管理', columns, store.list);
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
