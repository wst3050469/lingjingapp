<template>
  <div class="page">
    <h2 class="page-title">自动化任务</h2>
    <div class="toolbar"><a-button type="primary" @click="openCreate">新增任务</a-button></div>
    <a-table :dataSource="store.list" :columns="columns" rowKey="id" :loading="store.loading" size="small"
      :pagination="{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'is_enabled'">
          <a-switch :checked="record.is_enabled" disabled size="small" />
        </template>
        <template v-if="column.key === 'description_nl'">
          <span :title="record.description_nl">{{ record.description_nl || '-' }}</span>
        </template>
        <template v-if="column.key === 'cron_expr'">
          <code>{{ record.cron_expr || '-' }}</code>
        </template>
        <template v-if="column.key === 'last_run_at'">
          {{ record.last_run_at ? new Date(record.last_run_at).toLocaleString('zh-CN') : '-' }}
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" type="link" @click="handleTrigger(record.id)">触发</a-button>
            <a-button size="small" type="link" @click="editItem(record)">编辑</a-button>
            <a-popconfirm title="确定删除?" @confirm="store.remove(record.id)">
              <a-button size="small" type="link" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="showForm" :title="editing ? '编辑任务' : '新增任务'" @ok="save" :confirmLoading="saving" destroyOnClose width="640px">
      <a-form layout="vertical">
        <a-form-item label="任务名称" required>
          <a-input v-model:value="form.name" placeholder="输入任务名称" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="任务类型">
              <a-select v-model:value="form.task_type">
                <a-select-option value="custom">自定义</a-select-option>
                <a-select-option value="report">报表</a-select-option>
                <a-select-option value="notification">通知</a-select-option>
                <a-select-option value="sync">同步</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Cron 表达式">
              <a-input v-model:value="form.cron_expr" placeholder="例如: 0 8 * * *" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="任务说明">
          <a-textarea v-model:value="form.description_nl" :rows="4" placeholder="描述任务要做什么" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useAutomationStore } from '@/stores/automation';

const store = useAutomationStore();
const showForm = ref(false);
const saving = ref(false);
const editing = ref(false);
const editingId = ref(0);

const form = reactive({
  name: '',
  task_type: 'custom',
  cron_expr: '',
  description_nl: '',
});

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '任务类型', dataIndex: 'task_type', key: 'task_type', width: 100 },
  { title: 'Cron', key: 'cron_expr', width: 130 },
  { title: '说明', key: 'description_nl', ellipsis: true },
  { title: '启用', key: 'is_enabled', width: 60 },
  { title: '上次运行', key: 'last_run_at', width: 170 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' },
];

onMounted(() => store.loadList());

function openCreate() {
  resetForm();
  showForm.value = true;
}

function editItem(record: any) {
  editingId.value = record.id;
  form.name = record.name || '';
  form.task_type = record.task_type || 'custom';
  form.cron_expr = record.cron_expr || '';
  form.description_nl = record.description_nl || '';
  editing.value = true;
  showForm.value = true;
}

async function handleTrigger(id: number) {
  try {
    const msg = await store.trigger(id);
    message.success(msg || '任务已触发');
  } catch (e: any) {
    message.error(e?.response?.data?.detail || '触发失败');
  }
}

async function save() {
  if (!form.name) { message.warning('请输入任务名称'); return; }
  saving.value = true;
  try {
    if (editing.value) {
      await store.update(editingId.value, form);
    } else {
      await store.create(form);
    }
    showForm.value = false;
    resetForm();
    message.success(editing.value ? '任务已更新' : '任务已创建');
  } catch (e: any) {
    message.error(e?.response?.data?.detail || '操作失败');
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  form.name = '';
  form.task_type = 'custom';
  form.cron_expr = '';
  form.description_nl = '';
  editing.value = false;
  editingId.value = 0;
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 16px; }
</style>
