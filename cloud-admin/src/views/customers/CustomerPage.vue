<template>
  <div class="page">
    <h2 class="page-title">客户管理</h2>
    <div class="toolbar"><a-button type="primary" @click="showForm = true">新增客户</a-button></div>
    <a-table :dataSource="store.list" :columns="columns" rowKey="customer_id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.customer_id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑客户' : '新增客户'" @ok="save" :confirmLoading="saving" destroyOnClose>
      <a-form layout="vertical">
        <a-form-item label="名称"><a-input v-model:value="form.name" /></a-form-item>
        <a-form-item label="联系人"><a-input v-model:value="form.contact" /></a-form-item>
        <a-form-item label="电话"><a-input v-model:value="form.phone" /></a-form-item>
        <a-form-item label="地址"><a-input v-model:value="form.address" /></a-form-item>
        <a-form-item label="等级"><a-select v-model:value="form.level"><a-select-option value="普通">普通</a-select-option><a-select-option value="重要">重要</a-select-option><a-select-option value="VIP">VIP</a-select-option></a-select></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useCustomerStore } from '@/stores/customers';
const store = useCustomerStore();
const showForm = ref(false); const saving = ref(false); const editing = ref(false);
const form = reactive({ name: '', contact: '', phone: '', address: '', level: '普通' } as any);
const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' }, { title: '联系人', dataIndex: 'contact', key: 'contact' },
  { title: '电话', dataIndex: 'phone', key: 'phone' }, { title: '等级', dataIndex: 'level', key: 'level' },
  { title: '操作', key: 'action', width: 140 },
];
onMounted(() => store.loadList());
function editItem(record: any) { Object.assign(form, record); editing.value = true; showForm.value = true; }
async function save() {
  saving.value = true;
  try { editing.value ? await store.update(form.customer_id, form) : await store.create(form); showForm.value = false; resetForm(); }
  finally { saving.value = false; }
}
function resetForm() { form.name = ''; form.contact = ''; form.phone = ''; form.address = ''; form.level = '普通'; editing.value = false; }
</script>
<style scoped>
.page { padding: 24px; } .page-title { color: var(--text-primary); margin-bottom: 16px; } .toolbar { margin-bottom: 16px; }
</style>
