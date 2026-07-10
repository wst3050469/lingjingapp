<template>
  <div class="page">
    <h2 class="page-title">用户管理</h2>
    <a-tabs v-model:activeKey="tabKey" @change="onTabChange">
      <a-tab-pane key="registered" tab="注册用户">
        <div class="toolbar">
          <a-input-search v-model:value="searchKeyword" placeholder="搜索用户名/昵称/公司" style="width:280px" allowClear
            @search="doSearch" @pressEnter="doSearch" />
        </div>
        <a-table :dataSource="filteredUsers" :columns="userColumns" rowKey="id" :loading="userStore.loading" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'active' ? 'green' : record.status === 'pending' ? 'orange' : 'red'">{{ statusMap[record.status] }}</a-tag>
            </template>
            <template v-if="column.key === 'action'">
              <a-switch :checked="record.status === 'active'" @change="() => toggleUser(record)" size="small" />
            </template>
            <template v-if="column.key === 'time'">{{ formatTime(record.created_at) }}</template>
            <template v-if="column.key === 'last_login_at'">{{ record.last_login_at ? formatTime(record.last_login_at) : '从未登录' }}</template>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="invite" tab="个人邀请码">
        <div class="toolbar"><a-button type="primary" @click="showCreateInvite = true">生成邀请码</a-button></div>
        <a-table :dataSource="userStore.inviteCodes" :columns="inviteColumns" rowKey="id" :loading="userStore.loading" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'"><a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ record.status }}</a-tag></template>
            <template v-if="column.key === 'action'"><a-popconfirm title="确定删除?" @confirm="userStore.deleteInviteCode(record.id)"><a-button danger size="small">删除</a-button></a-popconfirm></template>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="team-invite" tab="团队邀请码">
        <div class="toolbar"><a-button type="primary" @click="showCreateTeamInvite = true">生成团队邀请码</a-button></div>
        <a-table :dataSource="userStore.teamInviteCodes" :columns="teamInviteColumns" rowKey="id" :loading="userStore.loading" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ record.status === 'active' ? '有效' : '已作废' }}</a-tag>
            </template>
            <template v-if="column.key === 'target_role'">{{ roleMap[record.target_role] || record.target_role }}</template>
            <template v-if="column.key === 'expires_at'">{{ record.expires_at ? new Date(record.expires_at).toLocaleString('zh-CN') : '永不过期' }}</template>
            <template v-if="column.key === 'time'">{{ formatTime(record.created_at) }}</template>
            <template v-if="column.key === 'action'">
              <a-popconfirm title="确定作废此邀请码?" @confirm="userStore.revokeTeamCode(record.code)" v-if="record.status === 'active'">
                <a-button danger size="small">作废</a-button>
              </a-popconfirm>
              <span v-else style="color:var(--text-tertiary)">-</span>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <!-- 生成个人邀请码 -->
    <a-modal v-model:open="showCreateInvite" title="生成个人邀请码" @ok="createInviteCode" :confirmLoading="creating">
      <a-form layout="vertical">
        <a-form-item label="昵称"><a-input v-model:value="inviteForm.nickname" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 生成团队邀请码 -->
    <a-modal v-model:open="showCreateTeamInvite" title="生成团队邀请码" @ok="createTeamInviteCode" :confirmLoading="creatingTeam" destroyOnClose>
      <a-form layout="vertical">
        <a-form-item label="目标租户" required>
          <a-select v-model:value="teamInviteForm.tenant_id" placeholder="选择租户" :options="tenantOptions" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="目标角色">
              <a-select v-model:value="teamInviteForm.target_role">
                <a-select-option value="owner">所有者</a-select-option>
                <a-select-option value="admin">管理员</a-select-option>
                <a-select-option value="member">普通成员</a-select-option>
                <a-select-option value="viewer">只读用户</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="最大使用次数">
              <a-input-number v-model:value="teamInviteForm.max_uses" :min="1" :max="999" style="width:100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="有效期（天）">
          <a-input-number v-model:value="teamInviteForm.expires_days" :min="0" :max="365" style="width:100%" />
          <div class="form-hint">设为 0 表示永不过期</div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useUserStore } from '@/stores/users';
import { tenantApi } from '@/api/modules';
import { message } from 'ant-design-vue';
import type { AppTenant } from '@/types';

const userStore = useUserStore();
const tabKey = ref('registered');
const showCreateInvite = ref(false);
const creating = ref(false);
const inviteForm = ref({ nickname: '' });

// 团队邀请码
const showCreateTeamInvite = ref(false);
const creatingTeam = ref(false);
const tenants = ref<AppTenant[]>([]);
const tenantOptions = computed(() => tenants.value.map(t => ({ label: `${t.company_name || t.tenant_id} (${t.tenant_id})`, value: t.tenant_id })));
const teamInviteForm = ref({ tenant_id: '', target_role: 'member', max_uses: 10, expires_days: 30 });

const statusMap: Record<string, string> = { active: '正常', pending: '待审核', disabled: '已禁用' };
const roleMap: Record<string, string> = { owner: '所有者', admin: '管理员', member: '普通成员', viewer: '只读用户' };

// 搜索
const searchKeyword = ref('');
const filteredUsers = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return userStore.registeredUsers;
  return userStore.registeredUsers.filter(u =>
    (u.username || '').toLowerCase().includes(kw) ||
    (u.nickname || '').toLowerCase().includes(kw)
  );
});

const userColumns = [
  { title: '用户名', dataIndex: 'username', key: 'username' }, { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
  { title: '状态', key: 'status' }, { title: '上次登录', dataIndex: 'last_login_at', key: 'last_login_at' }, { title: '注册时间', key: 'time' }, { title: '操作', key: 'action', width: 80 },
];
const inviteColumns = [
  { title: '邀请码', dataIndex: 'code', key: 'code' }, { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
  { title: '状态', key: 'status' }, { title: '操作', key: 'action', width: 80 },
];
const teamInviteColumns = [
  { title: '邀请码', dataIndex: 'code', key: 'code' },
  { title: '所属公司', dataIndex: 'company_name', key: 'company_name' },
  { title: '目标角色', key: 'target_role', width: 90 },
  { title: '使用次数', key: 'used_count', width: 80 },
  { title: '最大次数', dataIndex: 'max_uses', key: 'max_uses', width: 80 },
  { title: '过期时间', key: 'expires_at', width: 170 },
  { title: '状态', key: 'status', width: 70 },
  { title: '创建者', dataIndex: 'created_by', key: 'created_by', width: 100 },
  { title: '创建时间', key: 'time', width: 170 },
  { title: '操作', key: 'action', width: 80 },
];

onMounted(async () => {
  await Promise.all([
    userStore.loadRegistered(),
    userStore.loadInviteCodes(),
    loadTenants(),
  ]);
});

function onTabChange(key: string) {
  if (key === 'team-invite' && userStore.teamInviteCodes.length === 0) {
    userStore.loadTeamInviteCodes();
  }
}

async function loadTenants() {
  try {
    const res = await tenantApi.list();
    if (res.code === 0) tenants.value = res.data;
  } catch { /* ignore */ }
}

function doSearch() { /* computed handles filtering */ }

async function toggleUser(record: any) {
  try { await userStore.toggleUser('registered', record.id); await userStore.loadRegistered(); }
  catch (e: any) { console.error(e); }
}

async function createInviteCode() {
  creating.value = true;
  try { await userStore.createInviteCode({ nickname: inviteForm.value.nickname }); showCreateInvite.value = false; inviteForm.value.nickname = ''; }
  finally { creating.value = false; }
}

async function createTeamInviteCode() {
  if (!teamInviteForm.value.tenant_id) { message.warning('请选择目标租户'); return; }
  creatingTeam.value = true;
  try {
    await userStore.createTeamInviteCode({ ...teamInviteForm.value });
    showCreateTeamInvite.value = false;
    teamInviteForm.value = { tenant_id: '', target_role: 'member', max_uses: 10, expires_days: 30 };
    message.success('团队邀请码已生成');
  } catch (e: any) {
    message.error(e?.response?.data?.detail || '生成失败');
  } finally {
    creatingTeam.value = false;
  }
}

function formatTime(t: string) { if (!t) return ''; return new Date(t).toLocaleString('zh-CN'); }
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 16px; display: flex; gap: 12px; align-items: center; }
.form-hint { font-size: 12px; color: var(--text-tertiary); margin-top: 4px; }
</style>
