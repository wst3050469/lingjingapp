<template>
  <div class="page">
    <h2 class="page-title">供应商管理</h2>
    <div class="toolbar"><a-button type="primary" @click="openCreate">新增供应商</a-button><a-button @click="clearFilters" size="small" style="margin-left:8px">重置</a-button>
      <a-button @click="exportCsv" style="margin-left:8px">导出 CSV</a-button></div>

    <!-- 筛选栏 -->
    <a-card size="small" style="margin-bottom:16px">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-select v-model:value="filters.status" placeholder="状态筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="prospect">潜在</a-select-option>
            <a-select-option value="active">合作中</a-select-option>
            <a-select-option value="inactive">已暂停</a-select-option>
            <a-select-option value="blacklisted">黑名单</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="8">
          <a-select v-model:value="filters.material_type" placeholder="物料类型" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="原材料">原材料</a-select-option>
            <a-select-option value="辅料">辅料</a-select-option>
            <a-select-option value="包装">包装</a-select-option>
            <a-select-option value="设备">设备</a-select-option>
            <a-select-option value="服务">服务</a-select-option>
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
          <a-tag :color="record.status === 'active' ? 'green' : record.status === 'blacklisted' ? 'red' : 'orange'">{{ statusMap[record.status] || record.status }}</a-tag>
        </template>
        <template v-if="column.key === 'rating'">
          <a-rate :value="record.rating || 0" disabled />
        </template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑供应商' : '新增供应商'" @ok="save" :confirmLoading="saving" destroyOnClose width="640px">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="租户">
              <a-select v-model:value="form.tenant_id" placeholder="请选择租户">
                <a-select-option v-for="t in tenantList" :key="t.tenant_id" :value="t.tenant_id">{{ t.company_name || t.tenant_id }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12"><a-form-item label="名称"><a-input v-model:value="form.name" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="联系人"><a-input v-model:value="form.contact_person" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="电话"><a-input v-model:value="form.phone" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="分类"><a-input v-model:value="form.category" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="物料类型">
              <a-select v-model:value="form.material_type" allowClear>
                <a-select-option value="原材料">原材料</a-select-option>
                <a-select-option value="辅料">辅料</a-select-option>
                <a-select-option value="包装">包装</a-select-option>
                <a-select-option value="设备">设备</a-select-option>
                <a-select-option value="服务">服务</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="业务类型">
              <a-select v-model:value="form.business_type" allowClear>
                <a-select-option value="生产商">生产商</a-select-option>
                <a-select-option value="经销商">经销商</a-select-option>
                <a-select-option value="代理商">代理商</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="form.status">
                <a-select-option value="prospect">潜在</a-select-option>
                <a-select-option value="active">合作中</a-select-option>
                <a-select-option value="inactive">已暂停</a-select-option>
                <a-select-option value="blacklisted">黑名单</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="评分">
              <a-rate v-model:value="form.rating" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="地址"><a-input v-model:value="form.address" /></a-form-item>
        <a-form-item label="备注"><a-textarea v-model:value="form.notes" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { exportToCsv } from '@/utils/export';
import { useSupplierStore } from '@/stores/suppliers';
import { useTenantStore } from '@/stores/tenants';

const store = useSupplierStore();
const tenantStore = useTenantStore();

// 筛选状态
const filters = reactive({
  status: undefined as string | undefined,
  material_type: undefined as string | undefined,
});
const showForm = ref(false);
const saving = ref(false);
const editing = ref(false);
const editingId = ref(0);

const tenantList = computed(() => tenantStore.list);

const form = reactive({
  tenant_id: undefined, name: '', contact_person: '', phone: '', category: '',
  material_type: undefined, business_type: undefined,
  status: 'prospect', rating: 0, address: '', notes: '',
} as any);

onMounted(() => { store.loadList(); tenantStore.loadList(); });

function doFilter() {
  const params: Record<string, any> = {};
  if (filters.status) params.status = filters.status;
  if (filters.material_type) params.material_type = filters.material_type;
  store.loadList(Object.keys(params).length > 0 ? params : undefined);
}

function clearFilters() {
  filters.status = undefined;
  filters.material_type = undefined;
  store.loadList();
}

const statusMap: Record<string, string> = {
  prospect: '潜在', active: '合作中', inactive: '已暂停', blacklisted: '黑名单',
};

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '联系人', dataIndex: 'contact_person', key: 'contact_person' },
  { title: '电话', dataIndex: 'phone', key: 'phone' },
  { title: '物料类型', dataIndex: 'material_type', key: 'material_type' },
  { title: '评分', key: 'rating' },
  { title: '状态', key: 'status' },
  { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
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
  form.contact_person = record.contact_person || '';
  form.phone = record.phone || '';
  form.category = record.category || '';
  form.material_type = record.material_type || undefined;
  form.business_type = record.business_type || undefined;
  form.status = record.status || 'prospect';
  form.rating = record.rating || 0;
  form.address = record.address || '';
  form.notes = record.notes || '';
  editing.value = true;
  showForm.value = true;
}

async function save() {
  saving.value = true;
  try {
    if (!form.tenant_id) { message.warning('请选择租户'); saving.value = false; return; }
    if (!form.name) { message.warning('请输入供应商名称'); saving.value = false; return; }
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
  form.contact_person = '';
  form.phone = '';
  form.category = '';
  form.material_type = undefined;
  form.business_type = undefined;
  form.status = 'prospect';
  form.rating = 0;
  form.address = '';
  form.notes = '';
  editing.value = false;
  editingId.value = 0;
}

function exportCsv() {
  exportToCsv('供应商数据' + '-' + new Date().toISOString().slice(0,10), columns, store.list);
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 16px; }
</style>
