<template>
  <div class="page">
    <h2 class="page-title">合同管理</h2>
    <div class="toolbar"><a-button type="primary" @click="showForm = true">新建合同</a-button></div>
    <a-table :dataSource="store.list" :columns="columns" rowKey="contract_id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'amount'">¥{{ record.amount?.toLocaleString() }}</template>
        <template v-if="column.key === 'status'"><a-tag :color="record.status === '已签署' ? 'green' : 'orange'">{{ record.status }}</a-tag></template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.contract_id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑合同' : '新建合同'" @ok="save" :confirmLoading="saving" destroyOnClose>
      <a-form layout="vertical">
        <a-form-item label="合同名称"><a-input v-model:value="form.title" /></a-form-item>
        <a-form-item label="甲方"><a-input v-model:value="form.party_a" /></a-form-item>
        <a-form-item label="乙方"><a-input v-model:value="form.party_b" /></a-form-item>
        <a-form-item label="金额"><a-input-number v-model:value="form.amount" :min="0" style="width:100%" /></a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="form.status"><a-select-option value="草稿">草稿</a-select-option><a-select-option value="已签署">已签署</a-select-option></a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useContractStore } from '@/stores/contracts';

const store = useContractStore();
const showForm = ref(false); const saving = ref(false); const editing = ref(false);
const form = reactive({ title: '', party_a: '', party_b: '', amount: 0, status: '草稿' } as any);

const columns = [
  { title: '合同名称', dataIndex: 'title', key: 'title' }, { title: '甲方', dataIndex: 'party_a', key: 'party_a' },
  { title: '乙方', dataIndex: 'party_b', key: 'party_b' }, { title: '金额', key: 'amount' },
  { title: '状态', key: 'status' }, { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
  { title: '操作', key: 'action', width: 140 },
];

onMounted(() => store.loadList());

function editItem(record: any) { Object.assign(form, record); editing.value = true; showForm.value = true; }
async function save() {
  saving.value = true;
  try { editing.value ? await store.update(form.contract_id, form) : await store.create(form); showForm.value = false; resetForm(); }
  finally { saving.value = false; }
}
function resetForm() { form.title = ''; form.party_a = ''; form.party_b = ''; form.amount = 0; form.status = '草稿'; editing.value = false; }
</script>
<style scoped>
.page { padding: 24px; } .page-title { color: var(--text-primary); margin-bottom: 16px; } .toolbar { margin-bottom: 16px; }
</style>
