<template>
  <div class="page">
    <h2 class="page-title">财务管理</h2>
    <div class="toolbar">
      <a-button type="primary" @click="openCreate">新增记录</a-button>
      <a-button @click="clearFilters" size="small" style="margin-left:8px">重置筛选</a-button>
      <a-button @click="exportCsv" style="margin-left:8px">导出 CSV</a-button>
    </div>

    <!-- 筛选栏 -->
    <a-card size="small" style="margin-bottom:16px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-select v-model:value="filters.type" placeholder="类型筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="income">收入</a-select-option>
            <a-select-option value="expense">支出</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-select v-model:value="filters.category" placeholder="分类筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="办公费">办公费</a-select-option>
            <a-select-option value="差旅费">差旅费</a-select-option>
            <a-select-option value="采购">采购</a-select-option>
            <a-select-option value="工资">工资</a-select-option>
            <a-select-option value="租金">租金</a-select-option>
            <a-select-option value="销售收入">销售收入</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-select v-model:value="filters.status" placeholder="状态筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="pending">待审批</a-select-option>
            <a-select-option value="approved">已批准</a-select-option>
            <a-select-option value="rejected">已拒绝</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <span style="line-height:32px;color:#999">
            共 <strong>{{ store.list.length }}</strong> 条记录
          </span>
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
        pageSizeOptions: ['10', '20', '50'],
        showTotal: (t: number) => `共 ${t} 条`,
        onChange: (p: number) => store.setPage(p),
        onShowSizeChange: (_c: number, s: number) => store.setPageSize(s),
      }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'amount'"><span :style="{ color: record.type === 'income' ? '#52c41a' : '#f5222d' }">¥{{ record.amount?.toLocaleString() }}</span></template>
        <template v-if="column.key === 'type'"><a-tag :color="record.type === 'income' ? 'green' : 'red'">{{ typeMap[record.type] || record.type }}</a-tag></template>
        <template v-if="column.key === 'status'"><a-tag :color="record.status === 'approved' ? 'green' : record.status === 'rejected' ? 'red' : 'orange'">{{ statusMap[record.status] || record.status }}</a-tag></template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>

    <!-- 统计合计 -->
    <a-card size="small" style="margin-top:16px">
      <a-row :gutter="16">
        <a-col :span="6">
          <div style="text-align:center">
            <div style="color:#999;font-size:12px">总收入</div>
            <div style="color:#52c41a;font-size:24px;font-weight:bold">¥{{ totalIncome.toLocaleString() }}</div>
          </div>
        </a-col>
        <a-col :span="6">
          <div style="text-align:center">
            <div style="color:#999;font-size:12px">总支出</div>
            <div style="color:#f5222d;font-size:24px;font-weight:bold">¥{{ totalExpense.toLocaleString() }}</div>
          </div>
        </a-col>
        <a-col :span="6">
          <div style="text-align:center">
            <div style="color:#999;font-size:12px">净收益</div>
            <div :style="{color: netAmount >= 0 ? '#52c41a' : '#f5222d', fontSize: '24px', fontWeight: 'bold'}">¥{{ netAmount.toLocaleString() }}</div>
          </div>
        </a-col>
        <a-col :span="6">
          <div style="text-align:center">
            <div style="color:#999;font-size:12px">待审批</div>
            <div style="color:#fa8c16;font-size:24px;font-weight:bold">{{ pendingCount }}</div>
          </div>
        </a-col>
      </a-row>
    </a-card>

    <a-modal v-model:open="showForm" :title="editing ? '编辑财务记录' : '新增财务记录'" @ok="save" :confirmLoading="saving" destroyOnClose width="720px">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="租户">
              <a-select v-model:value="form.tenant_id" placeholder="请选择租户">
                <a-select-option v-for="t in tenantList" :key="t.tenant_id" :value="t.tenant_id">{{ t.company_name || t.tenant_id }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="类型">
              <a-radio-group v-model:value="form.type">
                <a-radio value="income">收入</a-radio>
                <a-radio value="expense">支出</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="金额"><a-input-number v-model:value="form.amount" :min="0" style="width:100%" /></a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="分类">
              <a-select v-model:value="form.category">
                <a-select-option value="办公费">办公费</a-select-option>
                <a-select-option value="差旅费">差旅费</a-select-option>
                <a-select-option value="采购">采购</a-select-option>
                <a-select-option value="工资">工资</a-select-option>
                <a-select-option value="租金">租金</a-select-option>
                <a-select-option value="销售收入">销售收入</a-select-option>
                <a-select-option value="其他">其他</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="申请人"><a-input v-model:value="form.applicant_name" /></a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="供应商"><a-input v-model:value="form.supplier_name" /></a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="费用日期"><a-date-picker v-model:value="form.expense_date" style="width:100%" /></a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="form.status">
                <a-select-option value="pending">待审批</a-select-option>
                <a-select-option value="approved">已批准</a-select-option>
                <a-select-option value="rejected">已拒绝</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="事由"><a-textarea v-model:value="form.reason" /></a-form-item>
        <a-form-item label="物料说明"><a-textarea v-model:value="form.material_desc" :rows="2" placeholder="相关物料、商品或服务描述" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { exportToCsv } from '@/utils/export';
import { useFinanceStore } from '@/stores/finance';
import { useTenantStore } from '@/stores/tenants';

const store = useFinanceStore();
const tenantStore = useTenantStore();
const showForm = ref(false);
const saving = ref(false);
const editing = ref(false);
const editingId = ref(0);

const tenantList = computed(() => tenantStore.list);

// 筛选状态
const filters = reactive({
  type: undefined as string | undefined,
  category: undefined as string | undefined,
  status: undefined as string | undefined,
});

const form = reactive({
  tenant_id: undefined, type: 'income', amount: 0, category: '',
  applicant_name: '', supplier_name: '', expense_date: null,
  status: 'pending', reason: '', material_desc: '',
} as any);

const typeMap: Record<string, string> = { income: '收入', expense: '支出' };
const statusMap: Record<string, string> = { pending: '待审批', approved: '已批准', rejected: '已拒绝' };

// 统计计算
const totalIncome = computed(() => store.list.filter((i: any) => i.type === 'income').reduce((s: number, i: any) => s + (i.amount || 0), 0));
const totalExpense = computed(() => store.list.filter((i: any) => i.type === 'expense').reduce((s: number, i: any) => s + (i.amount || 0), 0));
const netAmount = computed(() => totalIncome.value - totalExpense.value);
const pendingCount = computed(() => store.list.filter((i: any) => i.status === 'pending').length);

const columns = [
  { title: '类型', key: 'type' },
  { title: '金额', key: 'amount' },
  { title: '分类', dataIndex: 'category', key: 'category' },
  { title: '申请人', dataIndex: 'applicant_name', key: 'applicant_name' },
  { title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name' },
  { title: '物料说明', dataIndex: 'material_desc', key: 'material_desc', ellipsis: true },
  { title: '事由', dataIndex: 'reason', key: 'reason', ellipsis: true },
  { title: '状态', key: 'status' },
  { title: '费用日期', dataIndex: 'expense_date', key: 'expense_date' },
  { title: '操作', key: 'action', width: 140 },
];

onMounted(() => {
  store.loadList();
  tenantStore.loadList();
});

// 执行筛选
function doFilter() {
  const params: Record<string, any> = {};
  if (filters.type) params.type = filters.type;
  if (filters.category) params.category = filters.category;
  if (filters.status) params.status = filters.status;
  store.loadList(Object.keys(params).length > 0 ? params : undefined);
}

// 重置筛选
function exportCsv() {
  exportToCsv('财务记录_' + new Date().toISOString().slice(0,10), columns, store.list);
}

function clearFilters() {
  filters.type = undefined;
  filters.category = undefined;
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
  form.type = record.type || 'income';
  form.amount = record.amount || 0;
  form.category = record.category || '';
  form.applicant_name = record.applicant_name || '';
  form.supplier_name = record.supplier_name || '';
  form.expense_date = record.expense_date || null;
  form.status = record.status || 'pending';
  form.reason = record.reason || '';
  form.material_desc = record.material_desc || '';
  editing.value = true;
  showForm.value = true;
}

async function save() {
  saving.value = true;
  try {
    if (!form.tenant_id) { message.warning('请选择租户'); saving.value = false; return; }
    if (!(form.amount > 0)) { message.warning('请输入金额'); saving.value = false; return; }
    const data = { ...form };
    if (editing.value) {
      await store.update(editingId.value, data);
    } else {
      await store.create(data);
    }
    showForm.value = false;
    resetForm();
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  form.tenant_id = undefined;
  form.type = 'income';
  form.amount = 0;
  form.category = '';
  form.applicant_name = '';
  form.supplier_name = '';
  form.expense_date = null;
  form.status = 'pending';
  form.reason = '';
  form.material_desc = '';
  editing.value = false;
  editingId.value = 0;
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 8px; }
</style>
