<template>
  <div class="page">
    <h2 class="page-title">WebSocket 在线监控</h2>

    <!-- 统计卡片 -->
    <a-row :gutter="16" class="stat-cards">
      <a-col :span="8">
        <a-card class="stat-card">
          <div class="stat-value">{{ data.online_count }}</div>
          <div class="stat-label">在线用户</div>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card class="stat-card">
          <div class="stat-value">{{ data.total_devices }}</div>
          <div class="stat-label">设备总数</div>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card class="stat-card">
          <div class="stat-value">{{ onlineUsers.length }}</div>
          <div class="stat-label">在线用户列表</div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 操作栏 -->
    <div class="toolbar">
      <a-space>
        <a-button type="primary" @click="refreshData" :loading="loading">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button @click="showPushModal = true" :disabled="onlineUsers.length === 0">
          <template #icon><SendOutlined /></template>
          发送测试推送
        </a-button>
      </a-space>
      <span v-if="data.note" class="note">{{ data.note }}</span>
    </div>

    <!-- 在线用户表格 -->
    <a-table :dataSource="onlineUsers" :columns="columns" rowKey="uid" :loading="loading" size="small"
      :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag color="green">在线</a-tag>
        </template>
        <template v-if="column.key === 'devices'">
          {{ deviceCounts[record] ?? 1 }} 台设备
        </template>
        <template v-if="column.key === 'action'">
          <a-button size="small" type="link" @click="pushToUser(record)">推送消息</a-button>
        </template>
      </template>
    </a-table>

    <!-- 推送弹窗 -->
    <a-modal v-model:open="showPushModal" title="发送测试推送" @ok="handlePush" :confirmLoading="pushing" destroyOnClose>
      <a-form layout="vertical">
        <a-form-item label="目标用户" required>
          <a-select v-model:value="pushForm.user_id" placeholder="选择在线用户" :options="onlineUsers.map(u => ({ label: u, value: u }))" />
        </a-form-item>
        <a-form-item label="标题">
          <a-input v-model:value="pushForm.title" placeholder="推送标题" />
        </a-form-item>
        <a-form-item label="内容">
          <a-textarea v-model:value="pushForm.content" :rows="3" placeholder="推送内容" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SendOutlined } from '@ant-design/icons-vue';
import { wsApi } from '@/api/modules';

const loading = ref(false);
const data = reactive({ online_count: 0, total_devices: 0, note: '' });
const onlineUsers = ref<string[]>([]);
const deviceCounts = ref<Record<string, number>>({});

const columns = [
  { title: '用户 ID', dataIndex: 'uid', key: 'uid' },
  { title: '状态', key: 'status', width: 80 },
  { title: '设备数', key: 'devices', width: 100 },
  { title: '操作', key: 'action', width: 120 },
];

// 推送弹窗
const showPushModal = ref(false);
const pushing = ref(false);
const pushForm = reactive({ user_id: '', title: '🧪 测试推送', content: '这是一条来自管理后台的测试推送' });

async function refreshData() {
  loading.value = true;
  try {
    const [onlineRes, detailRes] = await Promise.all([
      wsApi.online(),
      wsApi.onlineDetail(),
    ]);
    data.online_count = onlineRes.online_count;
    data.total_devices = onlineRes.total_devices;
    data.note = onlineRes.note;
    onlineUsers.value = onlineRes.online_users.map((u: string) => u);
    deviceCounts.value = detailRes.devices || {};
  } catch (e: any) {
    message.error('获取在线数据失败');
  } finally {
    loading.value = false;
  }
}

async function handlePush() {
  if (!pushForm.user_id) { message.warning('请选择目标用户'); return; }
  pushing.value = true;
  try {
    const res = await wsApi.testPush(pushForm);
    message.success(res.msg);
    showPushModal.value = false;
    pushForm.user_id = '';
  } catch (e: any) {
    message.error(e?.response?.data?.detail || '推送失败');
  } finally {
    pushing.value = false;
  }
}

function pushToUser(uid: string) {
  pushForm.user_id = uid;
  showPushModal.value = true;
}

onMounted(refreshData);
</script>
<style scoped>
.page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 16px; }
.stat-cards { margin-bottom: 16px; }
.stat-card { text-align: center; }
.stat-value { font-size: 36px; font-weight: 700; color: var(--neon-cyan); }
.stat-label { font-size: 14px; color: var(--text-secondary); margin-top: 4px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.note { font-size: 12px; color: var(--text-tertiary); }
</style>
