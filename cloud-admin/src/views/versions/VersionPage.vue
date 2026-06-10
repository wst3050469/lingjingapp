<template>
  <div>
    <SearchFilter :show-search="false">
      <template #filters>
        <a-select v-model:value="store.statusFilter" placeholder="状态筛选" allow-clear style="width: 140px" @change="fetchData">
          <a-select-option value="draft">草稿</a-select-option>
          <a-select-option value="pending_review">待审核</a-select-option>
          <a-select-option value="approved">已通过</a-select-option>
          <a-select-option value="rejected">已驳回</a-select-option>
        </a-select>
      </template>
    </SearchFilter>

    <!-- 批量操作栏 -->
    <div v-if="selectedVersions.length > 0" class="batch-bar">
      <span class="batch-count">已选 {{ selectedVersions.length }} 个版本</span>
      <a-button
        size="small"
        type="primary"
        @click="handleBatchSubmit"
        :disabled="!selectedVersions.some(v => v.status === 'draft' || v.status === 'rejected')"
      >
        批量提交审核
      </a-button>
      <a-button size="small" @click="selectedVersions = []">取消</a-button>
    </div>

    <DataTable
      :columns="columns"
      :data-source="store.versions"
      :loading="store.loading"
      selectable
      @select="handleSelect"
      @batchDelete="handleBatchDelete"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <NeonTag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</NeonTag>
        </template>
        <template v-if="column.key === 'locked'">
          <span v-if="record.locked">🔒 已锁定</span>
          <span v-else style="color: var(--text-secondary)">—</span>
        </template>
        <template v-if="column.key === 'reviewer'">
          {{ record.reviewer || '—' }}
        </template>
        <template v-if="column.key === 'actions'">
          <a-button
            v-if="record.status === 'draft' || record.status === 'rejected'"
            type="link" size="small" @click="handleSubmitReview(record)"
          >提交审核</a-button>
          <a-button
            v-if="record.status === 'pending_review'"
            type="link" size="small" style="color: var(--neon-green)" @click="handleApprove(record)"
          >通过</a-button>
          <a-button
            v-if="record.status === 'pending_review'"
            type="link" size="small" danger @click="showReject(record)"
          >驳回</a-button>
          <a-button v-if="record.status === 'approved'" type="link" size="small" disabled>已发布</a-button>
        </template>
      </template>

      <!-- 展开行：审核时间线 -->
      <template #expandedRowRender="{ record }">
        <div v-if="record.submittedAt || record.reviewedAt || record.rejectReason" class="review-timeline">
          <div class="timeline-title">审核时间线</div>
          <a-timeline mode="left">
            <a-timeline-item v-if="record.submittedAt" color="blue">
              <template #dot><span style="font-size:12px">📤</span></template>
              提交审核 — {{ formatDate(record.submittedAt) }}
              <div style="color: var(--text-secondary); font-size: 12px">提交人: {{ record.submitter || '—' }}</div>
            </a-timeline-item>
            <a-timeline-item v-if="record.reviewedAt && record.status === 'approved'" color="green">
              <template #dot><span style="font-size:12px">✅</span></template>
              审核通过 — {{ formatDate(record.reviewedAt) }}
              <div style="color: var(--text-secondary); font-size: 12px">审核人: {{ record.reviewer || '—' }}</div>
            </a-timeline-item>
            <a-timeline-item v-if="record.reviewedAt && record.status === 'rejected'" color="red">
              <template #dot><span style="font-size:12px">❌</span></template>
              审核驳回 — {{ formatDate(record.reviewedAt) }}
              <div style="color: var(--text-secondary); font-size: 12px">审核人: {{ record.reviewer || '—' }}</div>
              <div v-if="record.rejectReason" style="color: var(--neon-orange); font-size: 12px; margin-top: 4px">
                原因: {{ record.rejectReason }}
              </div>
            </a-timeline-item>
            <a-timeline-item v-if="record.releaseDate" color="cyan">
              <template #dot><span style="font-size:12px">🚀</span></template>
              已发布 — {{ formatDate(record.releaseDate) }}
            </a-timeline-item>
          </a-timeline>
        </div>
        <div v-else style="color: var(--text-tertiary); padding: 16px;">
          暂无审核记录
        </div>
      </template>
    </DataTable>

    <GlowButton style="margin-top: 16px" @click="showCreateModal = true">创建版本</GlowButton>

    <!-- Create Version Modal -->
    <a-modal v-model:open="showCreateModal" title="创建版本" @ok="handleCreate">
      <a-form layout="vertical">
        <a-form-item label="版本号" required><a-input v-model:value="form.version" placeholder="例如: 1.71.0" /></a-form-item>
        <a-form-item label="变更日志"><a-textarea v-model:value="form.changelog" :rows="4" placeholder="描述此版本的变更内容..." /></a-form-item>
      </a-form>
    </a-modal>

    <!-- Reject Reason Modal -->
    <a-modal v-model:open="showRejectModal" title="驳回版本" @ok="handleReject">
      <a-form layout="vertical">
        <a-form-item label="驳回原因" required><a-textarea v-model:value="rejectReason" :rows="3" placeholder="请填写驳回原因..." /></a-form-item>
      </a-form>
    </a-modal>

    <ConfirmModal ref="confirmRef" title="审核通过" content="确定要通过此版本的审核吗？通过后版本将被锁定并同步到更新服务器。" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useVersionStore } from '@/stores/versions';
import { formatDate } from '@/utils/format';
import { message } from 'ant-design-vue';
import DataTable from '@/components/common/DataTable.vue';
import NeonTag from '@/components/neon/NeonTag.vue';
import GlowButton from '@/components/neon/GlowButton.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import SearchFilter from '@/components/common/SearchFilter.vue';
import type { Version } from '@/types';

const store = useVersionStore();
const confirmRef = ref();
const showCreateModal = ref(false);
const showRejectModal = ref(false);
const rejectReason = ref('');
const pendingRejectRecord = ref<Version | null>(null);
const form = reactive({ version: '', changelog: '' });
const selectedVersions = ref<Version[]>([]);

const statusLabel = (s: string) =>
  ({ draft: '草稿', pending_review: '待审核', approved: '已通过', rejected: '已驳回' } as any)[s] || s;

const statusColor = (s: string) =>
  ({ draft: 'cyan', pending_review: 'purple', approved: 'green', rejected: 'red' } as any)[s] || 'default';

const columns = [
  { title: '版本号', dataIndex: 'version', key: 'version', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '锁定', key: 'locked', width: 80 },
  { title: '审核人', key: 'reviewer', width: 120 },
  { title: '审核时间', dataIndex: 'reviewedAt', key: 'reviewed', width: 180 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created', width: 180 },
  { title: '操作', key: 'actions', width: 210 },
];

// ---- Selection ----
function handleSelect(keys: string[]) {
  selectedVersions.value = store.versions.filter((v: Version) => keys.includes((v as any)[store.rowKey] || (v as any).id));
}

// ---- Fetch ----
function fetchData() { store.fetchVersions(); }

// ---- Create ----
async function handleCreate() {
  if (!form.version.trim()) { message.warning('请输入版本号'); return; }
  await store.createVersion({ version: form.version.trim(), changelog: form.changelog.trim() });
  showCreateModal.value = false;
  form.version = ''; form.changelog = '';
  message.success('版本已创建');
}

// ---- Submit Review ----
async function handleSubmitReview(record: Version) {
  await store.submitReview(record.version);
  message.success(`版本 ${record.version} 已提交审核`);
}

async function handleBatchSubmit() {
  const drafts = selectedVersions.value.filter(v => v.status === 'draft' || v.status === 'rejected');
  if (!drafts.length) { message.warning('没有可提交的版本'); return; }
  for (const v of drafts) {
    try { await store.submitReview(v.version); } catch { /* continue */ }
  }
  selectedVersions.value = [];
  message.success(`已提交 ${drafts.length} 个版本`);
}

async function handleBatchDelete(keys: string[]) {
  // batch delete is informational — versions are typically locked
  message.info('版本不支持批量删除，请逐个操作');
}

// ---- Reject ----
function showReject(record: Version) {
  pendingRejectRecord.value = record;
  rejectReason.value = '';
  showRejectModal.value = true;
}

async function handleReject() {
  if (!rejectReason.value.trim()) { message.warning('请填写驳回原因'); return; }
  if (!pendingRejectRecord.value) return;
  await store.rejectVersion(pendingRejectRecord.value.version, rejectReason.value.trim());
  showRejectModal.value = false;
  rejectReason.value = '';
  pendingRejectRecord.value = null;
  message.success('版本已驳回');
}

// ---- Approve ----
async function handleApprove(record: Version) {
  try {
    await confirmRef.value?.show();
    await store.approveVersion(record.version);
    message.success(`版本 ${record.version} 审核通过，已锁定并同步`);
  } catch {}
}

onMounted(() => store.fetchVersions());
</script>

<style scoped>
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  margin-bottom: 12px;
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

.review-timeline {
  padding: 16px 24px;
  background: var(--dark-700);
  border-radius: 8px;
}

.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

@keyframes batch-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
