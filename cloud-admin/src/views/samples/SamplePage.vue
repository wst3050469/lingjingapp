<template>
  <div class="page">
    <h2 class="page-title">样品管理</h2>
    <div class="toolbar"><a-button type="primary" @click="openCreate">新增样品</a-button><a-button @click="clearFilters" size="small" style="margin-left:8px">重置</a-button>
      <a-button @click="exportCsv" style="margin-left:8px">导出 CSV</a-button></div>

    <!-- 筛选栏 -->
    <a-card size="small" style="margin-bottom:16px">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-select v-model:value="filters.status" placeholder="状态筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="drafted">草稿</a-select-option>
            <a-select-option value="in_progress">进行中</a-select-option>
            <a-select-option value="completed">已完成</a-select-option>
            <a-select-option value="failed">失败</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="8">
          <a-select v-model:value="filters.phase" placeholder="阶段筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="配方设计">配方设计</a-select-option>
            <a-select-option value="proofing">打样</a-select-option>
            <a-select-option value="testing">测试</a-select-option>
            <a-select-option value="confirmed">确认</a-select-option>
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
          <a-tag :color="record.status === 'completed' ? 'green' : record.status === 'failed' ? 'red' : 'orange'">{{ statusMap[record.status] || record.status }}</a-tag>
        </template>
        <template v-if="column.key === 'phase'">{{ phaseMap[record.phase] || record.phase }}</template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑样品' : '新增样品'" @ok="save" :confirmLoading="saving" destroyOnClose width="640px">
      <a-form layout="vertical">
        <a-form-item label="租户">
          <a-select v-model:value="form.tenant_id" placeholder="选择租户" allowClear>
            <a-select-option v-for="t in tenantList" :key="t.tenant_id" :value="t.tenant_id">{{ t.company_name || t.tenant_id }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="客户名称"><a-input v-model:value="form.customer_name" /></a-form-item>
        <a-form-item label="配方名称"><a-input v-model:value="form.recipe_name" /></a-form-item>
        <a-form-item label="项目名称"><a-input v-model:value="form.project_name" /></a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="form.status">
            <a-select-option value="drafted">草稿</a-select-option>
            <a-select-option value="in_progress">进行中</a-select-option>
            <a-select-option value="completed">已完成</a-select-option>
            <a-select-option value="failed">失败</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="阶段">
          <a-select v-model:value="form.phase">
            <a-select-option value="配方设计">配方设计</a-select-option>
            <a-select-option value="proofing">打样</a-select-option>
            <a-select-option value="testing">测试</a-select-option>
            <a-select-option value="confirmed">确认</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="备注"><a-textarea v-model:value="form.notes" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { exportToCsv } from '@/utils/export';
import { useSampleStore } from '@/stores/samples';
import { useTenantStore } from '@/stores/tenants';

const store = useSampleStore();
const tenantStore = useTenantStore();

// 筛选状态
const filters = reactive({
  status: undefined as string | undefined,
  phase: undefined as string | undefined,
});
const showForm = ref(false);
const saving = ref(false);
const editing = ref(false);
const editingId = ref(0);

const tenantList = computed(() => tenantStore.list);

const form = reactive({
  tenant_id: undefined, customer_name: '', recipe_name: '', project_name: '',
  status: 'drafted', phase: '', notes: '',
} as any);

const statusMap: Record<string, string> = {
  drafted: '草稿', in_progress: '进行中', completed: '已完成', failed: '失败',
};
const phaseMap: Record<string, string> = {
  '配方设计': '配方设计', proofing: '打样', testing: '测试', confirmed: '确认',
};

const columns = [
  { title: '客户', dataIndex: 'customer_name', key: 'customer_name' },
  { title: '配方', dataIndex: 'recipe_name', key: 'recipe_name' },
  { title: '项目', dataIndex: 'project_name', key: 'project_name' },
  { title: '阶段', key: 'phase' },
  { title: '状态', key: 'status' },
  { title: '备注', dataIndex: 'notes', key: 'notes', ellipsis: true },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
  { title: '操作', key: 'action', width: 140 },
];

onMounted(() => { store.loadList(); tenantStore.loadList(); });

function doFilter() {
  const params: Record<string, any> = {};
  if (filters.status) params.status = filters.status;
  if (filters.phase) params.phase = filters.phase;
  store.loadList(Object.keys(params).length > 0 ? params : undefined);
}

function clearFilters() {
  filters.status = undefined;
  filters.phase = undefined;
  store.loadList();
}

function openCreate() {
  resetForm();
  showForm.value = true;
}

function editItem(record: any) {
  editingId.value = record.id;
  form.tenant_id = record.tenant_id || undefined;
  form.customer_name = record.customer_name || '';
  form.recipe_name = record.recipe_name || '';
  form.project_name = record.project_name || '';
  form.status = record.status || 'drafted';
  form.phase = record.phase || '';
  form.notes = record.notes || '';
  editing.value = true;
  showForm.value = true;
}

async function save() {
  saving.value = true;
  try {
    if (!form.tenant_id) { message.warning('请选择租户'); saving.value = false; return; }
    if (!form.customer_name) { message.warning('请输入客户名称'); saving.value = false; return; }
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
  form.customer_name = '';
  form.recipe_name = '';
  form.project_name = '';
  form.status = 'drafted';
  form.phase = '';
  form.notes = '';
  editing.value = false;
  editingId.value = 0;
}

function exportCsv() {
  exportToCsv('样品数据' + '-' + new Date().toISOString().slice(0,10), columns, store.list);
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 16px; }
</style>
