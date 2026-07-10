<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">版本管理</h2>
      <div class="header-actions">
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索版本名称或说明"
          style="width:240px"
          allowClear
          @search="doSearch"
          @input="doSearch"
        />
        <a-button @click="handleExport" :disabled="filteredList.length === 0" size="small">
          <template #icon><DownloadOutlined /></template>
          导出 CSV
        </a-button>
        <a-button type="primary" @click="showUploadModal = true">上传新版本</a-button>
      </div>
    </div>

    <!-- 上传版本弹窗 -->
    <a-modal v-model:open="showUploadModal" title="上传新版本" @ok="handleUpload" :confirmLoading="uploading"
      :destroyOnClose="true">
      <a-form :model="form" layout="vertical">
        <a-form-item label="版本名称（如 1.2.3）" required>
          <a-input v-model:value="form.version_name" placeholder="例：1.2.3" />
        </a-form-item>
        <a-form-item label="版本号（整数，递增）" required>
          <a-input-number v-model:value="form.version_code" :min="1" style="width:100%" placeholder="例：123" />
        </a-form-item>
        <a-form-item label="更新说明">
          <a-textarea v-model:value="form.release_notes" :rows="4" placeholder="请输入更新说明" />
        </a-form-item>
        <a-form-item label="APK 文件" required>
          <a-upload :beforeUpload="(file: File) => { form.file = file; return false; }" :showUploadList="true" :maxCount="1"
            accept=".apk">
            <a-button><upload-outlined /> 选择 APK 文件</a-button>
          </a-upload>
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="form.is_force_update">强制更新</a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-table :dataSource="filteredList" :columns="columns" rowKey="id" :loading="store.loading" size="small"
      :pagination="{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'is_force_update'">
          <a-tag v-if="record.is_force_update" color="red">强制</a-tag>
          <a-tag v-else color="default">非强制</a-tag>
        </template>
        <template v-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template v-if="column.key === 'apk_size'">{{ (record.apk_size / 1024 / 1024).toFixed(1) }} MB</template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" type="link" v-if="record.status === 'pending_review'"
              @click="approve(record)">审核通过</a-button>
            <a-button size="small" type="link" danger v-if="record.status === 'pending_review'"
              @click="reject(record)">驳回</a-button>
            <a-button size="small" type="link" v-if="record.status === 'approved'"
              @click="store.publish(record.id)">发布</a-button>
            <a-button size="small" type="link" v-if="record.status === 'published'"
              @click="store.archive(record.id)">归档</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, reactive } from 'vue';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { useVersionStore } from '@/stores/versions';
import { versionApi } from '@/api/modules';
import { exportToCsv } from '@/utils/export';

const store = useVersionStore();

// 搜索
const searchKeyword = ref('');
const filteredList = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return store.list;
  return store.list.filter(t =>
    (t.version_name || '').toLowerCase().includes(kw) ||
    (t.release_notes || '').toLowerCase().includes(kw) ||
    (t.uploaded_by || '').toLowerCase().includes(kw)
  );
});

const columns = [
  { title: '版本名称', dataIndex: 'version_name', key: 'version_name' },
  { title: '版本号', dataIndex: 'version_code', key: 'version_code', width: 80 },
  { title: '更新说明', dataIndex: 'release_notes', key: 'release_notes', ellipsis: true },
  { title: '文件大小', key: 'apk_size', width: 100 },
  { title: '强制更新', key: 'is_force_update', width: 90 },
  { title: '上传者', dataIndex: 'uploaded_by', key: 'uploaded_by', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '发布时间', dataIndex: 'published_at', key: 'published_at', width: 170 },
  { title: '上传时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' },
];

function statusColor(status: string): string {
  const map: Record<string, string> = {
    published: 'green', pending_review: 'orange', rejected: 'red', archived: 'default', approved: 'blue',
  };
  return map[status] || 'default';
}
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    published: '已发布', pending_review: '待审核', rejected: '已驳回', archived: '已归档', approved: '已审核',
  };
  return map[status] || status;
}

// 上传弹窗状态
const showUploadModal = ref(false);
const uploading = ref(false);
const form = reactive({
  version_name: '',
  version_code: undefined as number | undefined,
  release_notes: '',
  is_force_update: false,
  file: null as File | null,
});

async function handleUpload() {
  if (!form.version_name) { message.warning('请输入版本名称'); return; }
  if (!form.version_code) { message.warning('请输入版本号'); return; }
  if (!form.file) { message.warning('请选择 APK 文件'); return; }
  uploading.value = true;
  try {
    const res = await versionApi.create({
      version_name: form.version_name,
      version_code: form.version_code!,
      release_notes: form.release_notes,
      is_force_update: form.is_force_update,
      file: form.file,
    });
    message.success(res.msg || '上传成功');
    showUploadModal.value = false;
    form.version_name = '';
    form.version_code = undefined;
    form.release_notes = '';
    form.is_force_update = false;
    form.file = null;
    await store.loadList();
  } catch (e: any) {
    message.error(e?.response?.data?.detail || '上传失败');
  } finally {
    uploading.value = false;
  }
}

onMounted(() => store.loadList());

async function approve(record: any) {
  try {
    const res = await versionApi.approve(record.id);
    message.success(res.msg);
    await store.loadList();
  } catch (e: any) {
    message.error(e?.response?.data?.detail || '操作失败');
  }
}
async function reject(record: any) {
  const reason = prompt('请输入驳回原因：');
  if (!reason) return;
  try {
    await versionApi.reject(record.id, reason);
    message.success('已驳回');
    await store.loadList();
  } catch (e: any) {
    message.error(e?.response?.data?.detail || '操作失败');
  }
}

// 搜索
function doSearch() {
  // computed 自动过滤
}

// 导出
const exportColumns = [
  { title: '版本名称', dataIndex: 'version_name', key: 'version_name' },
  { title: '版本号', dataIndex: 'version_code', key: 'version_code' },
  { title: '更新说明', dataIndex: 'release_notes', key: 'release_notes' },
  { title: '文件大小', dataIndex: 'apk_size', key: 'apk_size' },
  { title: '强制更新', dataIndex: 'is_force_update', key: 'is_force_update' },
  { title: '上传者', dataIndex: 'uploaded_by', key: 'uploaded_by' },
  { title: '状态', dataIndex: 'status', key: 'status' },
];
function handleExport() {
  exportToCsv('版本管理', exportColumns, filteredList.value);
}
</script>
<style scoped>
.page { padding: 24px; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.page-title { color: var(--text-primary); margin-bottom: 0; }
</style>
