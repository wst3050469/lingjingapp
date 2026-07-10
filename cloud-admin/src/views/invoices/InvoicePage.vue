<template>
  <div class="page">
    <h2 class="page-title">发票管理</h2>
    <div class="toolbar"><a-button type="primary" @click="openCreate">新增发票</a-button><a-button @click="clearFilters" size="small" style="margin-left:8px">重置</a-button>
      <a-button @click="exportCsv" style="margin-left:8px">导出 CSV</a-button></div>

    <!-- 筛选栏 -->
    <a-card size="small" style="margin-bottom:16px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-select v-model:value="filters.status" placeholder="状态筛选" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="draft">草稿</a-select-option>
            <a-select-option value="issued">已开票</a-select-option>
            <a-select-option value="cancelled">已作废</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-select v-model:value="filters.payment_status" placeholder="付款状态" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="unpaid">未付款</a-select-option>
            <a-select-option value="paid">已付款</a-select-option>
            <a-select-option value="partial">部分付款</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-select v-model:value="filters.invoice_type" placeholder="发票类型" allowClear style="width:100%" @change="doFilter">
            <a-select-option value="sales">销售发票</a-select-option>
            <a-select-option value="purchases">采购发票</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <span style="line-height:32px;color:#999">共 <strong>{{ store.list.length }}</strong> 条</span>
        </a-col>
      </a-row>
    </a-card>

    <a-table :dataSource="store.list" :columns="columns" rowKey="id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'amount'">¥{{ record.amount?.toLocaleString() }}</template>
        <template v-if="column.key === 'total_amount'">¥{{ record.total_amount?.toLocaleString() }}</template>
        <template v-if="column.key === 'status'"><a-tag :color="record.status === 'issued' ? 'green' : record.status === 'cancelled' ? 'red' : 'orange'">{{ statusMap[record.status] || record.status }}</a-tag></template>
        <template v-if="column.key === 'payment_status'"><a-tag :color="record.payment_status === 'paid' ? 'green' : 'orange'">{{ paymentMap[record.payment_status] || record.payment_status }}</a-tag></template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑发票' : '新增发票'" @ok="save" :confirmLoading="saving" destroyOnClose width="720px">
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
            <a-form-item label="发票编号"><a-input v-model:value="form.invoice_no" /></a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="发票名称"><a-input v-model:value="form.title" /></a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8"><a-form-item label="客户名称"><a-input v-model:value="form.customer_name" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="供应商名称"><a-input v-model:value="form.supplier_name" /></a-form-item></a-col>
          <a-col :span="8">
            <a-form-item label="发票类型">
              <a-select v-model:value="form.invoice_type">
                <a-select-option value="sales">销售发票</a-select-option>
                <a-select-option value="purchases">采购发票</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8"><a-form-item label="金额"><a-input-number v-model:value="form.amount" :min="0" style="width:100%" @change="calcTotal" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="税率(%)"><a-input-number v-model:value="form.tax_rate" :min="0" :max="100" style="width:100%" @change="calcTotal" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="税额"><a-input-number v-model:value="form.tax_amount" :min="0" style="width:100%" @change="calcTotal" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8"><a-form-item label="价税合计">¥{{ computedTotal }}</a-form-item></a-col>
          <a-col :span="8"><a-form-item label="发票日期"><a-date-picker v-model:value="form.invoice_date" style="width:100%" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="到期日期"><a-date-picker v-model:value="form.due_date" style="width:100%" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="状态">
              <a-select v-model:value="form.status">
                <a-select-option value="draft">草稿</a-select-option>
                <a-select-option value="issued">已开票</a-select-option>
                <a-select-option value="cancelled">已作废</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="付款状态">
              <a-select v-model:value="form.payment_status">
                <a-select-option value="unpaid">未付款</a-select-option>
                <a-select-option value="paid">已付款</a-select-option>
                <a-select-option value="partial">部分付款</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="分类"><a-input v-model:value="form.invoice_category" /></a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注"><a-textarea v-model:value="form.remarks" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { exportToCsv } from '@/utils/export';
import { useInvoiceStore } from '@/stores/invoices';
import { useTenantStore } from '@/stores/tenants';

const store = useInvoiceStore();
const tenantStore = useTenantStore();

// 筛选状态
const filters = reactive({
  status: undefined as string | undefined,
  payment_status: undefined as string | undefined,
  invoice_type: undefined as string | undefined,
});
const showForm = ref(false);
const saving = ref(false);
const editing = ref(false);
const editingId = ref(0);

const tenantList = computed(() => tenantStore.list);

const form = reactive({
  tenant_id: undefined, invoice_no: '', title: '', customer_name: '',
  supplier_name: '', invoice_type: 'sales', amount: 0, tax_rate: 0,
  tax_amount: 0, invoice_date: null, due_date: null,
  status: 'draft', payment_status: 'unpaid', invoice_category: '', remarks: '',
} as any);

const statusMap: Record<string, string> = { draft: '草稿', issued: '已开票', cancelled: '已作废' };
const paymentMap: Record<string, string> = { unpaid: '未付款', paid: '已付款', partial: '部分付款' };

const computedTotal = computed(() => {
  const total = (form.amount || 0) + (form.tax_amount || 0);
  return '¥' + total.toLocaleString();
});

function calcTotal() {
  const rate = (form.tax_rate || 0) / 100;
  form.tax_amount = parseFloat(((form.amount || 0) * rate).toFixed(2));
}

const columns = [
  { title: '发票编号', dataIndex: 'invoice_no', key: 'invoice_no' },
  { title: '名称', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '客户', dataIndex: 'customer_name', key: 'customer_name' },
  { title: '金额', key: 'amount' },
  { title: '价税合计', key: 'total_amount' },
  { title: '类型', dataIndex: 'invoice_type', key: 'invoice_type' },
  { title: '状态', key: 'status' },
  { title: '付款状态', key: 'payment_status' },
  { title: '发票日期', dataIndex: 'invoice_date', key: 'invoice_date' },
  { title: '操作', key: 'action', width: 140 },
];

onMounted(() => { store.loadList(); tenantStore.loadList(); });

function doFilter() {
  const params: Record<string, any> = {};
  if (filters.status) params.status = filters.status;
  if (filters.payment_status) params.payment_status = filters.payment_status;
  if (filters.invoice_type) params.invoice_type = filters.invoice_type;
  store.loadList(Object.keys(params).length > 0 ? params : undefined);
}

function clearFilters() {
  filters.status = undefined;
  filters.payment_status = undefined;
  filters.invoice_type = undefined;
  store.loadList();
}

function openCreate() {
  resetForm();
  showForm.value = true;
}

function editItem(record: any) {
  editingId.value = record.id;
  form.tenant_id = record.tenant_id || undefined;
  form.invoice_no = record.invoice_no || '';
  form.title = record.title || '';
  form.customer_name = record.customer_name || '';
  form.supplier_name = record.supplier_name || '';
  form.invoice_type = record.invoice_type || 'sales';
  form.amount = record.amount || 0;
  form.tax_rate = record.tax_rate || 0;
  form.tax_amount = record.tax_amount || 0;
  form.invoice_date = record.invoice_date || null;
  form.due_date = record.due_date || null;
  form.status = record.status || 'draft';
  form.payment_status = record.payment_status || 'unpaid';
  form.invoice_category = record.invoice_category || '';
  form.remarks = record.remarks || '';
  editing.value = true;
  showForm.value = true;
}

async function save() {
  saving.value = true;
  try {
    if (!form.tenant_id) { message.warning('请选择租户'); saving.value = false; return; }
    if (!form.title) { message.warning('请输入发票名称'); saving.value = false; return; }
    const data = { ...form, total_amount: (form.amount || 0) + (form.tax_amount || 0) };
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
  form.invoice_no = '';
  form.title = '';
  form.customer_name = '';
  form.supplier_name = '';
  form.invoice_type = 'sales';
  form.amount = 0;
  form.tax_rate = 0;
  form.tax_amount = 0;
  form.invoice_date = null;
  form.due_date = null;
  form.status = 'draft';
  form.payment_status = 'unpaid';
  form.invoice_category = '';
  form.remarks = '';
  editing.value = false;
  editingId.value = 0;
}

function exportCsv() {
  exportToCsv('发票数据' + '-' + new Date().toISOString().slice(0,10), columns, store.list);
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 16px; }
</style>
