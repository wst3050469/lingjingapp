<template>
  <div class="page">
    <h2 class="page-title">租户管理</h2>
    <a-table :dataSource="tenantStore.list" :columns="columns" rowKey="tenant_id" :loading="tenantStore.loading" size="small" @expand="expandTenant">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ record.status }}</a-tag>
        </template>
        <template v-if="column.key === 'plan'"><a-tag>{{ record.plan }}</a-tag></template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="viewMembers(record)">成员</a-button>
          <a-popconfirm title="确定删除?" @confirm="tenantStore.deleteTenant(record.tenant_id)">
            <a-button size="small" danger style="margin-left:4px">删除</a-button>
          </a-popconfirm>
        </template>
      </template>
      <template #expandedRowRender="{ record }">
        <div v-if="expandedTenant === record.tenant_id">
          <a-table :dataSource="tenantMembers" :columns="memberColumns" rowKey="user_id" size="small" :pagination="false">
            <template #bodyCell="{ column, record: m }">
              <template v-if="column.key === 'role'"><a-tag>{{ m.role }}</a-tag></template>
            </template>
          </a-table>
        </div>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useTenantStore } from '@/stores/tenants';
import type { AppTenantMember } from '@/types';

const tenantStore = useTenantStore();
const expandedTenant = ref<string | null>(null);
const tenantMembers = ref<AppTenantMember[]>([]);

const columns = [
  { title: '公司名称', dataIndex: 'company_name', key: 'company_name' },
  { title: '行业', dataIndex: 'industry', key: 'industry' },
  { title: '负责人', dataIndex: 'owner_name', key: 'owner_name' },
  { title: '套餐', key: 'plan' },
  { title: '状态', key: 'status' },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
  { title: '操作', key: 'action', width: 140 },
];
const memberColumns = [
  { title: '用户名', dataIndex: 'user_id', key: 'user_id' },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '角色', key: 'role' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '加入时间', dataIndex: 'joined_at', key: 'joined_at' },
];

onMounted(() => { tenantStore.loadList(); });

async function viewMembers(record: any) {
  expandedTenant.value = expandedTenant.value === record.tenant_id ? null : record.tenant_id;
  if (expandedTenant.value) {
    await tenantStore.loadMembers(record.tenant_id);
    tenantMembers.value = tenantStore.members;
  }
}

async function expandTenant(expanded: boolean, record: any) {
  if (expanded) {
    expandedTenant.value = record.tenant_id;
    await tenantStore.loadMembers(record.tenant_id);
    tenantMembers.value = tenantStore.members;
  } else {
    expandedTenant.value = null;
  }
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
</style>
