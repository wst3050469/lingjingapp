<template>
  <div>
    <DataTable :columns="columns" :data-source="store.subscriptions" :loading="store.loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
        </template>
      </template>
    </DataTable>
    <a-modal v-model:open="showModal" title="编辑订阅" @ok="handleSave">
      <a-form layout="vertical">
        <a-form-item label="计划"><a-select v-model:value="form.plan_name"><a-select-option value="free">Free</a-select-option><a-select-option value="pro">Pro</a-select-option><a-select-option value="enterprise">Enterprise</a-select-option></a-select></a-form-item>
        <a-form-item label="状态"><a-select v-model:value="form.status"><a-select-option value="active">Active</a-select-option><a-select-option value="expired">Expired</a-select-option><a-select-option value="cancelled">Cancelled</a-select-option></a-select></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useSubscriptionStore } from '@/stores/subscriptions';
import { message } from 'ant-design-vue';
import DataTable from '@/components/common/DataTable.vue';

const store = useSubscriptionStore();
const showModal = ref(false);
const editingId = ref<string>();
const form = reactive({ plan_name: '', status: '' });

const columns = [
  { title: '计划', dataIndex: 'plan_name', key: 'plan', width: 120 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '到期时间', dataIndex: 'expires_at', key: 'expires', width: 180 },
  { title: '操作', key: 'actions', width: 100 },
];

function handleEdit(record: any) { editingId.value = record.id; form.plan_name = record.plan_name; form.status = record.status; showModal.value = true; }
function handleSave() { showModal.value = false; message.success('保存成功'); }

onMounted(() => store.fetchSubscriptions());
</script>