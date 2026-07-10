<template>
  <div class="page">
    <h2 class="page-title">合同管理</h2>
    <div class="toolbar"><a-button type="primary" @click="openCreate">新建合同</a-button><a-button @click="clearFilters" size="small" style="margin-left:8px">重置</a-button>
      <a-button @click="exportCsv" style="margin-left:8px">导出 CSV</a-button></div>

    <!-- 筛选栏 -->
    <a-card size="small" style="margin-bottom:16px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-select v-model:value="filters.status" placeholder="状态筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="draft">草稿</a-select-option>
            <a-select-option value="signed">已签署</a-select-option>
            <a-select-option value="expired">已过期</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="18">
          <span style="line-height:32px;color:#999">共 <strong>{{ store.list.length }}</strong> 条合同</span>
        </a-col>
      </a-row>
    </a-card>

    <a-table :dataSource="store.list" :columns="columns" rowKey="id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'amount'">¥{{ record.amount?.toLocaleString() }}</template>
        <template v-if="column.key === 'status'"><a-tag :color="record.status === 'signed' ? 'green' : 'orange'">{{ statusMap[record.status] || record.status }}</a-tag></template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑合同' : '新建合同'" @ok="save" :confirmLoading="saving" destroyOnClose width="720px">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="租户">
              <a-select v-model:value="form.tenant_id" placeholder="请选择租户">
                <a-select-option v-for="t in tenantList" :key="t.tenant_id" :value="t.tenant_id">{{ t.company_name || t.tenant_id }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="合同编号"><a-input v-model:value="form.contract_no" /></a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="合同名称"><a-input v-model:value="form.title" /></a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="甲方"><a-input v-model:value="form.party_a" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="乙方"><a-input v-model:value="form.party_b" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8"><a-form-item label="签订日期"><a-date-picker v-model:value="form.sign_date" style="width:100%" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="开始日期"><a-date-picker v-model:value="form.start_date" style="width:100%" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="结束日期"><a-date-picker v-model:value="form.end_date" style="width:100%" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="金额"><a-input-number v-model:value="form.amount" :min="0" style="width:100%" /></a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="form.status">
                <a-select-option value="draft">草稿</a-select-option>
                <a-select-option value="signed">已签署</a-select-option>
                <a-select-option value="expired">已过期</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="文件链接"><a-input v-model:value="form.file_url" placeholder="https://..." /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { exportToCsv } from '@/utils/export';
import { useContractStore } from '@/stores/contracts';
import { useTenantStore } from '@/stores/tenants';

const store = useContractStore();
const tenantStore = useTenantStore();

// 筛选状态
const filters = reactive({
  status: undefined as string | undefined,
});
const showForm = ref(false);
const saving = ref(false);
const editing = ref(false);
const editingId = ref(0);

const tenantList = computed(() => tenantStore.list);

const form = reactive({
  tenant_id: undefined, contract_no: '', title: '', party_a: '', party_b: '',
  amount: 0, sign_date: null, start_date: null, end_date: null,
  status: 'draft', file_url: '',
} as any);

const statusMap: Record<string, string> = {
  draft: '草稿', signed: '已签署', expired: '已过期',
};

const columns = [
  { title: '合同编号', dataIndex: 'contract_no', key: 'contract_no' },
  { title: '合同名称', dataIndex: 'title', key: 'title' },
  { title: '甲方', dataIndex: 'party_a', key: 'party_a' },
  { title: '乙方', dataIndex: 'party_b', key: 'party_b' },
  { title: '金额', key: 'amount' },
  { title: '状态', key: 'status' },
  { title: '签订日期', dataIndex: 'sign_date', key: 'sign_date' },
  { title: '操作', key: 'action', width: 140 },
];

onMounted(() => { store.loadList(); tenantStore.loadList(); });

function doFilter() {
  const params: Record<string, any> = {};
  if (filters.status) params.status = filters.status;
  store.loadList(Object.keys(params).length > 0 ? params : undefined);
}

function clearFilters() {
  filters.status = undefined;
  store.loadList();
}

function openCreate() {
  resetForm();
  showForm.value = true;
}

function editItem(record: any) {
  editingId.value = record.id;
  form.tenant_id = record.tenant_id || undefined;
  form.contract_no = record.contract_no || '';
  form.title = record.title || '';
  form.party_a = record.party_a || '';
  form.party_b = record.party_b || '';
  form.amount = record.amount || 0;
  form.sign_date = record.sign_date || null;
  form.start_date = record.start_date || null;
  form.end_date = record.end_date || null;
  form.status = record.status || 'draft';
  form.file_url = record.file_url || '';
  editing.value = true;
  showForm.value = true;
}

async function save() {
  saving.value = true;
  try {
    if (!form.tenant_id) { message.warning('请选择租户'); saving.value = false; return; }
    if (!form.title) { message.warning('请输入合同名称'); saving.value = false; return; }
    if (editing.value) {
      await store.update(editingId.value, form);
    } else {
      await store.create(form);
    }
    showForm.value = false;
    resetForm();
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  form.tenant_id = undefined;
  form.contract_no = '';
  form.title = '';
  form.party_a = '';
  form.party_b = '';
  form.amount = 0;
  form.sign_date = null;
  form.start_date = null;
  form.end_date = null;
  form.status = 'draft';
  form.file_url = '';
  editing.value = false;
  editingId.value = 0;
}

function exportCsv() {
  exportToCsv('合同数据' + '-' + new Date().toISOString().slice(0,10), columns, store.list);
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 16px; }
</style>
