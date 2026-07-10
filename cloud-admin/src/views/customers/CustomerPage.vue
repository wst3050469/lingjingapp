<template>
  <div class="page">
    <h2 class="page-title">客户管理</h2>
    <div class="toolbar"><a-button type="primary" @click="openCreate">新增客户</a-button><a-button @click="clearFilters" size="small" style="margin-left:8px">重置</a-button>
      <a-button @click="exportCsv" style="margin-left:8px">导出 CSV</a-button></div>

    <!-- 筛选栏 -->
    <a-card size="small" style="margin-bottom:16px">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-select v-model:value="filters.status" placeholder="状态筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="lead">潜在</a-select-option>
            <a-select-option value="active">活跃</a-select-option>
            <a-select-option value="inactive">不活跃</a-select-option>
            <a-select-option value="lost">已流失</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="8">
          <a-select v-model:value="filters.source" placeholder="来源筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="chat">聊天</a-select-option>
            <a-select-option value="referral">推荐</a-select-option>
            <a-select-option value="ad">广告</a-select-option>
            <a-select-option value="event">展会</a-select-option>
            <a-select-option value="other">其他</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="8">
          <span style="line-height:32px;color:#999">共 <strong>{{ store.list.length }}</strong> 条</span>
        </a-col>
      </a-row>
    </a-card>

    <a-table :dataSource="store.list" :columns="columns" rowKey="id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'active' ? 'green' : 'orange'">{{ statusMap[record.status] || record.status }}</a-tag>
        </template>
        <template v-if="column.key === 'source'">{{ sourceMap[record.source] || record.source }}</template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑客户' : '新增客户'" @ok="save" :confirmLoading="saving" destroyOnClose width="640px">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="租户">
              <a-select v-model:value="form.tenant_id" placeholder="请选择租户">
                <a-select-option v-for="t in tenantList" :key="t.tenant_id" :value="t.tenant_id">{{ t.company_name || t.tenant_id }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12"><a-form-item label="客户名称"><a-input v-model:value="form.name" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="公司名称"><a-input v-model:value="form.company" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="联系人"><a-input v-model:value="form.contact_person" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="电话"><a-input v-model:value="form.phone" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="来源">
              <a-select v-model:value="form.source">
                <a-select-option value="chat">聊天</a-select-option>
                <a-select-option value="referral">推荐</a-select-option>
                <a-select-option value="ad">广告</a-select-option>
                <a-select-option value="event">展会</a-select-option>
                <a-select-option value="other">其他</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="form.status">
                <a-select-option value="lead">潜在</a-select-option>
                <a-select-option value="active">活跃</a-select-option>
                <a-select-option value="inactive">不活跃</a-select-option>
                <a-select-option value="lost">已流失</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注"><a-textarea v-model:value="form.notes" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { exportToCsv } from '@/utils/export';
import { useCustomerStore } from '@/stores/customers';
import { useTenantStore } from '@/stores/tenants';

const store = useCustomerStore();
const tenantStore = useTenantStore();

// 筛选状态
const filters = reactive({
  status: undefined as string | undefined,
  source: undefined as string | undefined,
});
const showForm = ref(false);
const saving = ref(false);
const editing = ref(false);
const editingId = ref(0);

const tenantList = computed(() => tenantStore.list);

const form = reactive({
  tenant_id: undefined, name: '', company: '', contact_person: '', phone: '',
  source: 'chat', status: 'lead', notes: '',
} as any);

onMounted(() => { store.loadList(); tenantStore.loadList(); });

function doFilter() {
  const params: Record<string, any> = {};
  if (filters.status) params.status = filters.status;
  if (filters.source) params.source = filters.source;
  store.loadList(Object.keys(params).length > 0 ? params : undefined);
}

function clearFilters() {
  filters.status = undefined;
  filters.source = undefined;
  store.loadList();
}

const statusMap: Record<string, string> = {
  lead: '潜在', active: '活跃', inactive: '不活跃', lost: '已流失',
};
const sourceMap: Record<string, string> = {
  chat: '聊天', referral: '推荐', ad: '广告', event: '展会', other: '其他',
};

const columns = [
  { title: '客户名称', dataIndex: 'name', key: 'name' },
  { title: '公司', dataIndex: 'company', key: 'company' },
  { title: '联系人', dataIndex: 'contact_person', key: 'contact_person' },
  { title: '电话', dataIndex: 'phone', key: 'phone' },
  { title: '来源', key: 'source' },
  { title: '状态', key: 'status' },
  { title: '备注', dataIndex: 'notes', key: 'notes', ellipsis: true },
  { title: '操作', key: 'action', width: 140 },
];

onMounted(() => store.loadList());

function openCreate() {
  resetForm();
  showForm.value = true;
}

function editItem(record: any) {
  editingId.value = record.id;
  form.tenant_id = record.tenant_id || undefined;
  form.name = record.name || '';
  form.company = record.company || '';
  form.contact_person = record.contact_person || '';
  form.phone = record.phone || '';
  form.source = record.source || 'chat';
  form.status = record.status || 'lead';
  form.notes = record.notes || '';
  editing.value = true;
  showForm.value = true;
}

async function save() {
  saving.value = true;
  try {
    if (!form.tenant_id) { message.warning('请选择租户'); saving.value = false; return; }
    if (!form.name) { message.warning('请输入客户名称'); saving.value = false; return; }
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
  form.name = '';
  form.company = '';
  form.contact_person = '';
  form.phone = '';
  form.source = 'chat';
  form.status = 'lead';
  form.notes = '';
  editing.value = false;
  editingId.value = 0;
}

function exportCsv() {
  exportToCsv('客户数据' + '-' + new Date().toISOString().slice(0,10), columns, store.list);
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 16px; }
</style>
