<template>
  <div class="page">
    <h2 class="page-title">样本管理</h2>
    <div class="toolbar"><a-button type="primary" @click="showForm = true">新增样本</a-button></div>
    <a-table :dataSource="store.list" :columns="columns" rowKey="id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑样本' : '新增样本'" @ok="save" :confirmLoading="saving" destroyOnClose>
      <a-form layout="vertical">
        <a-form-item label="名称"><a-input v-model:value="form.name" /></a-form-item>
        <a-form-item label="分类"><a-input v-model:value="form.category" /></a-form-item>
        <a-form-item label="描述"><a-textarea v-model:value="form.description" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'; import { useSampleStore } from '@/stores/samples';
const store = useSampleStore(); const showForm = ref(false); const saving = ref(false); const editing = ref(false);
const form = reactive({ name: '', category: '', description: '' } as any);
const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' }, { title: '分类', dataIndex: 'category', key: 'category' },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '操作', key: 'action', width: 140 },
];
onMounted(() => store.loadList());
function editItem(record: any) { Object.assign(form, record); editing.value = true; showForm.value = true; }
async function save() {
  saving.value = true; try { editing.value ? await store.update(form.id, form) : await store.create(form); showForm.value = false; resetForm(); } finally { saving.value = false; }
}
function resetForm() { form.name = ''; form.category = ''; form.description = ''; editing.value = false; }
</script>
<style scoped>
.page { padding: 24px; } .page-title { color: var(--text-primary); margin-bottom: 16px; } .toolbar { margin-bottom: 16px; }
</style>
