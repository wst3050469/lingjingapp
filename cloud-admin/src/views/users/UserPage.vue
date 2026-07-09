<template>
  <div class="page">
    <h2 class="page-title">用户管理</h2>
    <a-tabs v-model:activeKey="tabKey">
      <a-tab-pane key="registered" tab="注册用户">
        <a-table :dataSource="userStore.registeredUsers" :columns="userColumns" rowKey="id" :loading="userStore.loading" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'active' ? 'green' : record.status === 'pending' ? 'orange' : 'red'">{{ statusMap[record.status] }}</a-tag>
            </template>
            <template v-if="column.key === 'action'">
              <a-switch :checked="record.status === 'active'" @change="() => toggleUser(record)" size="small" />
            </template>
            <template v-if="column.key === 'time'">{{ formatTime(record.created_at) }}</template>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="invite" tab="邀请码">
        <div class="toolbar"><a-button type="primary" @click="showCreateInvite = true">生成邀请码</a-button></div>
        <a-table :dataSource="userStore.inviteCodes" :columns="inviteColumns" rowKey="id" :loading="userStore.loading" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'"><a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ record.status }}</a-tag></template>
            <template v-if="column.key === 'action'"><a-popconfirm title="确定删除?" @confirm="userStore.deleteInviteCode(record.id)"><a-button danger size="small">删除</a-button></a-popconfirm></template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>
    <a-modal v-model:open="showCreateInvite" title="生成邀请码" @ok="createInviteCode" :confirmLoading="creating">
      <a-form layout="vertical">
        <a-form-item label="昵称"><a-input v-model:value="inviteForm.nickname" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useUserStore } from '@/stores/users';

const userStore = useUserStore();
const tabKey = ref('registered');
const showCreateInvite = ref(false);
const creating = ref(false);
const inviteForm = ref({ nickname: '' });
const statusMap: Record<string, string> = { active: '正常', pending: '待审核', disabled: '已禁用' };

const userColumns = [
  { title: '用户名', dataIndex: 'username', key: 'username' }, { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
  { title: '类型', dataIndex: 'account_type', key: 'account_type' }, { title: '公司', dataIndex: 'company_name', key: 'company_name' },
  { title: '状态', key: 'status' }, { title: '注册时间', key: 'time' }, { title: '操作', key: 'action', width: 80 },
];
const inviteColumns = [
  { title: '邀请码', dataIndex: 'code', key: 'code' }, { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
  { title: '状态', key: 'status' }, { title: '操作', key: 'action', width: 80 },
];

onMounted(async () => { await userStore.loadRegistered(); await userStore.loadInviteCodes(); });

async function toggleUser(record: any) {
  try { await userStore.toggleUser('registered', record.id); await userStore.loadRegistered(); }
  catch (e: any) { console.error(e); }
}

async function createInviteCode() {
  creating.value = true;
  try { await userStore.createInviteCode({ nickname: inviteForm.value.nickname }); showCreateInvite.value = false; inviteForm.value.nickname = ''; }
  finally { creating.value = false; }
}

function formatTime(t: string) { if (!t) return ''; return new Date(t).toLocaleString('zh-CN'); }
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 16px; }
</style>
