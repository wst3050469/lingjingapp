<template>
  <div class="page">
    <h2 class="page-title">租户管理</h2>
    <div class="toolbar">
      <a-input-search
        v-model:value="searchKeyword"
        placeholder="搜索公司名称或负责人"
        style="width:280px"
        allowClear
        @search="doSearch"
        @input="doSearch"
      />
      <a-button @click="handleExport" :disabled="tenantStore.list.length === 0" size="small">
        <template #icon><DownloadOutlined /></template>
        导出 CSV
      </a-button>
    </div>
    <a-table :dataSource="filteredList" :columns="columns" rowKey="tenant_id" :loading="tenantStore.loading" size="small" @expand="expandTenant">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ record.status === 'active' ? '正常' : '禁用' }}</a-tag>
        </template>
        <template v-if="column.key === 'plan'"><a-tag>{{ record.plan }}</a-tag></template>
        <template v-if="column.key === 'action'">
          <a-button size="small" @click="viewDetail(record)">详情</a-button>
          <a-button size="small" @click="editTenant(record)" style="margin-left:4px">编辑</a-button>
          <a-button size="small" @click="viewMembers(record)" style="margin-left:4px">成员</a-button>
          <a-popconfirm title="确定删除此租户？将级联删除所有关联数据！" @confirm="tenantStore.deleteTenant(record.tenant_id)">
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

    <!-- 租户详情抽屉 -->
    <a-drawer
      v-model:open="detailOpen"
      :title="'租户详情 - ' + (detailTenant?.company_name || '')"
      placement="right"
      width="560px"
      :loading="detailLoading"
    >
      <template v-if="dash">
        <a-descriptions title="基本信息" :column="2" size="small" bordered>
          <a-descriptions-item label="租户ID">{{ detailTenant?.tenant_id }}</a-descriptions-item>
          <a-descriptions-item label="公司名称">{{ detailTenant?.company_name }}</a-descriptions-item>
          <a-descriptions-item label="行业">{{ detailTenant?.industry || '-' }}</a-descriptions-item>
          <a-descriptions-item label="负责人">{{ detailTenant?.owner_name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="套餐">{{ detailTenant?.plan }}</a-descriptions-item>
          <a-descriptions-item label="状态"><a-tag :color="detailTenant?.status === 'active' ? 'green' : 'red'">{{ detailTenant?.status === 'active' ? '正常' : '禁用' }}</a-tag></a-descriptions-item>
        </a-descriptions>

        <a-divider />

        <a-row :gutter="16">
          <a-col :span="12">
            <a-card size="small" title="👥 成员" style="margin-bottom:12px">
              <div style="text-align:center;padding:8px">
                <span style="font-size:32px;font-weight:bold;color:var(--neon-cyan)">{{ dash.members?.total || 0 }}</span>
                <div style="color:var(--text-secondary);font-size:12px;margin-top:4px">
                  <span v-for="(cnt, role) in dash.members?.roles || {}" :key="role" style="margin-right:8px">{{ role }}: {{ cnt }}</span>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="12">
            <a-card size="small" title="💬 对话" style="margin-bottom:12px">
              <div style="text-align:center;padding:8px">
                <span style="font-size:32px;font-weight:bold;color:var(--neon-blue)">{{ dash.chat?.sessions || 0 }}</span>
                <div style="color:var(--text-secondary);font-size:12px;margin-top:4px">
                  {{ dash.chat?.messages || 0 }} 条消息
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-card size="small" title="📋 项目" style="margin-bottom:12px">
              <div style="text-align:center;padding:4px">
                <span style="font-size:24px;font-weight:bold;color:var(--neon-green)">{{ dash.business?.projects || 0 }}</span>
              </div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card size="small" title="👤 客户" style="margin-bottom:12px">
              <div style="text-align:center;padding:4px">
                <span style="font-size:24px;font-weight:bold;color:var(--neon-orange)">{{ dash.business?.customers || 0 }}</span>
              </div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card size="small" title="🏭 供应商" style="margin-bottom:12px">
              <div style="text-align:center;padding:4px">
                <span style="font-size:24px;font-weight:bold;color:var(--neon-purple)">{{ dash.business?.suppliers || 0 }}</span>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-card size="small" title="💰 财务概览" style="margin-bottom:12px">
          <a-row :gutter="16">
            <a-col :span="8">
              <div style="text-align:center">
                <div style="color:var(--text-secondary);font-size:12px">总收入</div>
                <div style="color:#52c41a;font-size:18px;font-weight:bold">¥{{ (dash.business?.finance?.total_income || 0).toLocaleString() }}</div>
              </div>
            </a-col>
            <a-col :span="8">
              <div style="text-align:center">
                <div style="color:var(--text-secondary);font-size:12px">总支出</div>
                <div style="color:#f5222d;font-size:18px;font-weight:bold">¥{{ (dash.business?.finance?.total_expense || 0).toLocaleString() }}</div>
              </div>
            </a-col>
            <a-col :span="8">
              <div style="text-align:center">
                <div style="color:var(--text-secondary);font-size:12px">待审批</div>
                <div style="color:#fa8c16;font-size:18px;font-weight:bold">{{ dash.business?.finance?.pending || 0 }}</div>
              </div>
            </a-col>
          </a-row>
        </a-card>

        <a-card size="small" title="🧠 AI 数据">
          <a-row :gutter="16">
            <a-col :span="12">
              <div style="text-align:center;padding:4px">
                <div style="color:var(--text-secondary);font-size:12px">记忆条数</div>
                <div style="font-size:20px;font-weight:bold">{{ dash.ai?.memories || 0 }}</div>
              </div>
            </a-col>
            <a-col :span="12">
              <div style="text-align:center;padding:4px">
                <div style="color:var(--text-secondary);font-size:12px">活跃待办</div>
                <div style="font-size:20px;font-weight:bold">{{ dash.ai?.todos_active || 0 }}</div>
              </div>
            </a-col>
          </a-row>
        </a-card>
      </template>
      <template v-else>
        <a-empty description="暂无数据" />
      </template>
    </a-drawer>

    <!-- 编辑租户弹窗 -->
    <a-modal v-model:open="showEdit" title="编辑租户" @ok="saveTenant" :confirmLoading="saving" destroyOnClose>
      <a-form layout="vertical">
        <a-form-item label="公司名称">{{ editForm.company_name }}</a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="editForm.status">
            <a-select-option value="active">正常</a-select-option>
            <a-select-option value="disabled">禁用</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="套餐">
          <a-select v-model:value="editForm.plan">
            <a-select-option value="basic">基础版</a-select-option>
            <a-select-option value="pro">专业版</a-select-option>
            <a-select-option value="enterprise">企业版</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { DownloadOutlined } from '@ant-design/icons-vue';
import { useTenantStore } from '@/stores/tenants';
import type { AppTenantMember } from '@/types';
import { message } from 'ant-design-vue';
import { exportToCsv } from '@/utils/export';

const tenantStore = useTenantStore();
const expandedTenant = ref<string | null>(null);
const tenantMembers = ref<AppTenantMember[]>([]);

// 搜索
const searchKeyword = ref('');
const filteredList = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return tenantStore.list;
  return tenantStore.list.filter(t =>
    (t.company_name || '').toLowerCase().includes(kw) ||
    (t.owner_name || '').toLowerCase().includes(kw) ||
    (t.tenant_id || '').toLowerCase().includes(kw)
  );
});

// 编辑状态
const showEdit = ref(false);
const saving = ref(false);
const editForm = reactive({
  tenant_id: '', company_name: '', status: 'active', plan: 'basic',
});

// 详情抽屉
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailTenant = ref<any>(null);
const dash = ref<any>(null);

const columns = [
  { title: '公司名称', dataIndex: 'company_name', key: 'company_name' },
  { title: '行业', dataIndex: 'industry', key: 'industry' },
  { title: '负责人', dataIndex: 'owner_name', key: 'owner_name' },
  { title: '套餐', key: 'plan' },
  { title: '状态', key: 'status' },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
  { title: '操作', key: 'action', width: 280 },
];
const memberColumns = [
  { title: '用户名', dataIndex: 'user_id', key: 'user_id' },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '角色', key: 'role' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '加入时间', dataIndex: 'joined_at', key: 'joined_at' },
];

onMounted(() => { tenantStore.loadList(); });

// 租户详情
async function viewDetail(record: any) {
  detailTenant.value = record;
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    await tenantStore.loadDashboard(record.tenant_id);
    dash.value = tenantStore.dashboardData;
  } catch {
    dash.value = null;
  } finally {
    detailLoading.value = false;
  }
}

// 编辑租户
function editTenant(record: any) {
  editForm.tenant_id = record.tenant_id;
  editForm.company_name = record.company_name || '';
  editForm.status = record.status || 'active';
  editForm.plan = record.plan || 'basic';
  showEdit.value = true;
}

async function saveTenant() {
  saving.value = true;
  try {
    await tenantStore.updateTenant(editForm.tenant_id, {
      status: editForm.status,
      plan: editForm.plan,
    });
    message.success('租户已更新');
    showEdit.value = false;
  } finally {
    saving.value = false;
  }
}

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

function doSearch() {
  // 计算属性 filteredList 自动处理搜索
}

const exportColumns = [
  { title: '公司名称', dataIndex: 'company_name', key: 'company_name' },
  { title: '行业', dataIndex: 'industry', key: 'industry' },
  { title: '负责人', dataIndex: 'owner_name', key: 'owner_name' },
  { title: '电话', dataIndex: 'owner_phone', key: 'owner_phone' },
  { title: '套餐', dataIndex: 'plan', key: 'plan' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '成员数', dataIndex: 'member_count', key: 'member_count' },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
];
function handleExport() {
  exportToCsv('租户管理', exportColumns, filteredList.value);
}
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.toolbar { margin-bottom: 16px; }
</style>
