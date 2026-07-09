<template>
  <div class="page">
    <h2 class="page-title">自动化任务</h2>
    <div class="toolbar"><a-button type="primary" @click="showForm = true">新增任务</a-button></div>
    <a-table :dataSource="store.list" :columns="columns" rowKey="id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'enabled'"><a-switch :checked="record.enabled" disabled size="small" /></template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="store.trigger(record.id)" style="margin-right:4px">触发</a-button>
          <a-button size="small" @click="editItem(record)">编辑</a-button>
          <a-popconfirm title="确定删除?" @confirm="store.remove(record.id)"><a-button size="small" danger style="margin-left:4px">删除</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showForm" :title="editing ? '编辑任务' : '新增任务'" @ok="save" :confirmLoading="saving" destroyOnClose>
      <a-form layout="vertical">
        <a-form-item label="名称"><a-input v-model:value="form.name" /></a-form-item>
        <a-form-item label="触发类型"><a-input v-model:value="form.trigger_type" placeholder="例如: schedule, webhook" /></a-form-item>
        <a-form-item label="动作类型"><a-input v-model:value="form.action_type" placeholder="例如: api_call, notification" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'; import { useAutomationStore } from '@/stores/automation';
const store = useAutomationStore(); const showForm = ref(false); const saving = ref(false); const editing = ref(false);
const form = reactive({ name: '', trigger_type: '', action_type: '' } as any);
const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' }, { title: '触发类型', dataIndex: 'trigger_type', key: 'trigger_type' },
  { title: '动作类型', dataIndex: 'action_type', key: 'action_type' }, { title: '启用', key: 'enabled' },
  { title: '最后运行', dataIndex: 'last_run', key: 'last_run' }, { title: '操作', key: 'action', width: 200 },
];
onMounted(() => store.loadList());
function editItem(record: any) { Object.assign(form, record); editing.value = true; showForm.value = true; }
async function save() {
  saving.value = true; try { editing.value ? await store.update(form.id, form) : await store.create(form); showForm.value = false; resetForm(); } finally { saving.value = false; }
}
function resetForm() { form.name = ''; form.trigger_type = ''; form.action_type = ''; editing.value = false; }
</script>
<style scoped>
.page { padding: 24px; } .page-title { color: var(--text-primary); margin-bottom: 16px; } .toolbar { margin-bottom: 16px; }
</style>
