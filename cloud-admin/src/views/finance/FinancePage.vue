<template>
  <div class="page">
    <h2 class="page-title">财务管理</h2>
    <div class="toolbar"><a-button type="primary" @click="showForm = true">新增记录</a-button></div>
    <a-table :dataSource="store.list" :columns="columns" rowKey="record_id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'amount'"><span :style="{ color: record.type === '收入' ? '#52c41a' : '#f5222d' }">¥{{ record.amount?.toLocaleString() }}</span></template>
        <template v-if="column.key === 'type'"><a-tag :color="record.type === '收入' ? 'green' : 'red'">{{ record.type }}</a-tag></template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.record_id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑财务记录' : '新增财务记录'" @ok="save" :confirmLoading="saving" destroyOnClose>
      <a-form layout="vertical">
        <a-form-item label="类型"><a-radio-group v-model:value="form.type"><a-radio value="收入">收入</a-radio><a-radio value="支出">支出</a-radio></a-radio-group></a-form-item>
        <a-form-item label="金额"><a-input-number v-model:value="form.amount" :min="0" style="width:100%" /></a-form-item>
        <a-form-item label="分类"><a-input v-model:value="form.category" /></a-form-item>
        <a-form-item label="描述"><a-textarea v-model:value="form.description" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'; import { useFinanceStore } from '@/stores/finance';
const store = useFinanceStore(); const showForm = ref(false); const saving = ref(false); const editing = ref(false);
const form = reactive({ type: '收入', amount: 0, category: '', description: '' } as any);
const columns = [
  { title: '类型', key: 'type' }, { title: '金额', key: 'amount' }, { title: '分类', dataIndex: 'category', key: 'category' },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '日期', dataIndex: 'record_date', key: 'record_date' }, { title: '操作', key: 'action', width: 140 },
];
onMounted(() => store.loadList());
function editItem(record: any) { Object.assign(form, record); editing.value = true; showForm.value = true; }
async function save() {
  saving.value = true; try { editing.value ? await store.update(form.record_id, form) : await store.create(form); showForm.value = false; resetForm(); } finally { saving.value = false; }
}
function resetForm() { form.type = '收入'; form.amount = 0; form.category = ''; form.description = ''; editing.value = false; }
</script>
<style scoped>
.page { padding: 24px; } .page-title { color: var(--text-primary); margin-bottom: 16px; } .toolbar { margin-bottom: 16px; }
</style>
