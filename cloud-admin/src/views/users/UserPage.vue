<template>
  <div>
    <DataTable :columns="columns" :data-source="store.users" :loading="store.loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
          <a-button type="link" size="small" danger @click="handleDelete(record)">删除</a-button>
        </template>
      </template>
    </DataTable>
    <GlowButton style="margin-top: 16px" @click="showModal = true">创建用户</GlowButton>
    <a-modal v-model:open="showModal" :title="editingId ? '编辑用户' : '创建用户'" @ok="handleSave">
      <a-form layout="vertical">
        <a-form-item label="用户名"><a-input v-model:value="form.username" /></a-form-item>
        <a-form-item label="邮箱"><a-input v-model:value="form.email" /></a-form-item>
        <a-form-item label="角色"><a-select v-model:value="form.role"><a-select-option value="admin">Admin</a-select-option><a-select-option value="user">User</a-select-option></a-select></a-form-item>
      </a-form>
    </a-modal>
    <ConfirmModal ref="confirmRef" danger title="删除用户" content="确定要删除此用户吗？" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useUserStore } from '@/stores/users';
import { message } from 'ant-design-vue';
import DataTable from '@/components/common/DataTable.vue';
import GlowButton from '@/components/neon/GlowButton.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

const store = useUserStore();
const confirmRef = ref();
const showModal = ref(false);
const editingId = ref<string>();
const form = reactive({ username: '', email: '', role: 'user' });

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 150 },
  { title: '邮箱', dataIndex: 'email', key: 'email', width: 200 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '注册时间', dataIndex: 'created_at', key: 'created', width: 180 },
  { title: '操作', key: 'actions', width: 150 },
];

function handleEdit(record: any) { editingId.value = record.id; form.username = record.username; form.email = record.email; form.role = record.role; showModal.value = true; }
async function handleSave() {
  if (editingId.value) { await store.updateUser(editingId.value, form); } else { await store.createUser(form); }
  showModal.value = false; editingId.value = undefined; message.success('保存成功');
}
async function handleDelete(record: any) { try { await confirmRef.value?.show(); await store.deleteUser(record.id); } catch {} }

onMounted(() => store.fetchUsers());
</script>