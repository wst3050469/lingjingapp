<template>
  <div class="page">
    <h2 class="page-title">发票管理</h2>
    <div class="toolbar"><a-button type="primary" @click="showForm = true">新增发票</a-button></div>
    <a-table :dataSource="store.list" :columns="columns" rowKey="invoice_id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'amount'">¥{{ record.amount?.toLocaleString() }}</template>
        <template v-if="column.key === 'status'"><a-tag :color="record.status === '已开票' ? 'green' : 'orange'">{{ record.status }}</a-tag></template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.invoice_id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑发票' : '新增发票'" @ok="save" :confirmLoading="saving" destroyOnClose>
      <a-form layout="vertical">
        <a-form-item label="发票名称"><a-input v-model:value="form.title" /></a-form-item>
        <a-form-item label="金额"><a-input-number v-model:value="form.amount" :min="0" style="width:100%" /></a-form-item>
        <a-form-item label="类型"><a-select v-model:value="form.invoice_type"><a-select-option value="增值税专用发票">增值税专用发票</a-select-option><a-select-option value="普通发票">普通发票</a-select-option></a-select></a-form-item>
        <a-form-item label="状态"><a-select v-model:value="form.status"><a-select-option value="待开票">待开票</a-select-option><a-select-option value="已开票">已开票</a-select-option></a-select></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useInvoiceStore } from '@/stores/invoices';
const store = useInvoiceStore();
const showForm = ref(false); const saving = ref(false); const editing = ref(false);
const form = reactive({ title: '', amount: 0, invoice_type: '普通发票', status: '待开票' } as any);
const columns = [
  { title: '发票名称', dataIndex: 'title', key: 'title' }, { title: '金额', key: 'amount' },
  { title: '类型', dataIndex: 'invoice_type', key: 'invoice_type' }, { title: '状态', key: 'status' },
  { title: '发票日期', dataIndex: 'invoice_date', key: 'invoice_date' }, { title: '操作', key: 'action', width: 140 },
];
onMounted(() => store.loadList());
function editItem(record: any) { Object.assign(form, record); editing.value = true; showForm.value = true; }
async function save() {
  saving.value = true;
  try { editing.value ? await store.update(form.invoice_id, form) : await store.create(form); showForm.value = false; resetForm(); }
  finally { saving.value = false; }
}
function resetForm() { form.title = ''; form.amount = 0; form.invoice_type = '普通发票'; form.status = '待开票'; editing.value = false; }
</script>
<style scoped>
.page { padding: 24px; } .page-title { color: var(--text-primary); margin-bottom: 16px; } .toolbar { margin-bottom: 16px; }
</style>
