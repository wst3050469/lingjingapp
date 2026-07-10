<template>
  <div class="page">
    <h2 class="page-title">配方管理</h2>
    <div class="toolbar"><a-button type="primary" @click="openCreate">新增配方</a-button><a-button @click="clearFilters" size="small" style="margin-left:8px">重置</a-button>
      <a-button @click="exportCsv" style="margin-left:8px">导出 CSV</a-button></div>

    <!-- 筛选栏 -->
    <a-card size="small" style="margin-bottom:16px">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-select v-model:value="filters.status" placeholder="状态筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="active">启用</a-select-option>
            <a-select-option value="inactive">停用</a-select-option>
            <a-select-option value="deleted">已删除</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="16">
          <span style="line-height:32px;color:#999">共 <strong>{{ store.list.length }}</strong> 条配方</span>
        </a-col>
      </a-row>
    </a-card>

    <a-table :dataSource="store.list" :columns="columns" rowKey="id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'active' ? 'green' : 'orange'">{{ record.status === 'active' ? '启用' : '停用' }}</a-tag>
        </template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑配方' : '新增配方'" @ok="save" :confirmLoading="saving" destroyOnClose width="720px">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="租户">
              <a-select v-model:value="form.tenant_id" placeholder="选择租户" allowClear>
                <a-select-option v-for="t in tenantList" :key="t.tenant_id" :value="t.tenant_id">{{ t.company_name || t.tenant_id }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8"><a-form-item label="名称"><a-input v-model:value="form.name" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="分类"><a-input v-model:value="form.category" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="描述"><a-textarea v-model:value="form.description" /></a-form-item>
        <a-form-item label="原料（每行一个，格式：名称:用量）">
          <div v-for="(item, idx) in form.ingredients" :key="idx" style="display:flex;gap:8px;margin-bottom:8px">
            <a-input v-model:value="item.name" placeholder="原料名称" style="flex:1" />
            <a-input v-model:value="item.amount" placeholder="用量" style="width:120px" />
            <a-button type="link" danger @click="removeIngredient(idx)">删除</a-button>
          </div>
          <a-button size="small" @click="addIngredient">+ 添加原料</a-button>
        </a-form-item>
        <a-form-item label="步骤">
          <div v-for="(step, idx) in form.steps" :key="'s'+idx" style="display:flex;gap:8px;margin-bottom:8px">
            <span style="width:24px;flex-shrink:0">{{ idx+1 }}.</span>
            <a-textarea v-model:value="step.content" placeholder="步骤描述" :rows="2" style="flex:1" />
            <a-button type="link" danger @click="removeStep(idx)">删除</a-button>
          </div>
          <a-button size="small" @click="addStep">+ 添加步骤</a-button>
        </a-form-item>
        <a-form-item label="状态">
          <a-switch v-model:checked="isActive" checked-children="启用" un-checked-children="停用" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { exportToCsv } from '@/utils/export';
import { useRecipeStore } from '@/stores/recipes';
import { useTenantStore } from '@/stores/tenants';

const store = useRecipeStore();
const tenantStore = useTenantStore();

// 筛选状态
const filters = reactive({
  status: undefined as string | undefined,
});
const showForm = ref(false);
const saving = ref(false);
const editing = ref(false);
const editingId = ref('');
const isActive = ref(true);

const tenantList = computed(() => tenantStore.list);

const form = reactive({
  tenant_id: undefined, name: '', category: '', description: '',
  ingredients: [] as { name: string; amount: string }[],
  steps: [] as { content: string }[],
  status: 'active',
} as any);

onMounted(() => { store.loadList(); tenantStore.loadList(); });

watch(isActive, (val) => { form.status = val ? 'active' : 'inactive'; });

function doFilter() {
  const params: Record<string, any> = {};
  if (filters.status) params.status = filters.status;
  store.loadList(Object.keys(params).length > 0 ? params : undefined);
}

function clearFilters() {
  filters.status = undefined;
  store.loadList();
}

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '分类', dataIndex: 'category', key: 'category' },
  { title: '原料数', key: 'ingredients' },
  { title: '步骤数', key: 'steps' },
  { title: '状态', key: 'status' },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '操作', key: 'action', width: 140 },
];

function openCreate() {
  resetForm();
  showForm.value = true;
}

function addIngredient() { form.ingredients.push({ name: '', amount: '' }); }
function removeIngredient(idx: number) { form.ingredients.splice(idx, 1); }
function addStep() { form.steps.push({ content: '' }); }
function removeStep(idx: number) { form.steps.splice(idx, 1); }

function editItem(record: any) {
  editingId.value = record.id;
  form.tenant_id = record.tenant_id || undefined;
  form.name = record.name || '';
  form.category = record.category || '';
  form.description = record.description || '';
  form.ingredients = Array.isArray(record.ingredients) ? [...record.ingredients] : [];
  form.steps = Array.isArray(record.steps) ? [...record.steps] : [];
  form.status = record.status || 'active';
  isActive.value = form.status === 'active';
  editing.value = true;
  showForm.value = true;
}

async function save() {
  saving.value = true;
  try {
    if (!form.name) { message.warning('请输入配方名称'); saving.value = false; return; }
    if (!form.tenant_id) { message.warning('请选择租户'); saving.value = false; return; }
    // Convert ingredients/steps to arrays for JSONB
    const data = {
      tenant_id: form.tenant_id,
      name: form.name,
      category: form.category,
      description: form.description,
      ingredients: form.ingredients.filter((i: any) => i.name || i.amount),
      steps: form.steps.filter((s: any) => s.content),
      status: form.status,
    };
    if (editing.value) {
      await store.update(editingId.value, data);
    } else {
      await store.create(data);
    }
    message.success(editing.value ? '配方已更新' : '配方已创建');
    showForm.value = false;
    resetForm();
  } catch (e: any) {
    message.error(e?.response?.data?.detail || '保存失败');
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  form.tenant_id = undefined;
  form.name = '';
  form.category = '';
  form.description = '';
  form.ingredients = [];
  form.steps = [];
  form.status = 'active';
  isActive.value = true;
  editing.value = false;
  editingId.value = '';
}

function exportCsv() {
  exportToCsv('配方数据' + '-' + new Date().toISOString().slice(0,10), columns, store.list);
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 16px; }
</style>
