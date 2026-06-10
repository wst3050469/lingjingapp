<template>
  <div>
    <a-tabs v-model:activeKey="activeTab">
      <!-- Tab 1: Webhooks -->
      <a-tab-pane key="webhooks" tab="Webhook管理">
        <DataTable :columns="webhookColumns" :data-source="webhookLogs" :loading="loading" :show-pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <NeonTag :color="record.status === 'success' ? 'green' : 'red'">{{ record.status }}</NeonTag>
            </template>
            <template v-if="column.key === 'actions'">
              <a-button type="link" size="small" @click="handleTestWebhook(record)">测试</a-button>
            </template>
          </template>
        </DataTable>
      </a-tab-pane>

      <!-- Tab 2: Schedules -->
      <a-tab-pane key="schedules" tab="定时任务">
        <DataTable :columns="scheduleColumns" :data-source="scheduleStore.schedules" :loading="scheduleStore.loading">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'enabled'">
              <a-switch
                :checked="record.enabled"
                @change="(v: boolean) => scheduleStore.updateSchedule(record.id, { enabled: v })"
              />
            </template>
            <template v-if="column.key === 'actions'">
              <a-button type="link" size="small" danger @click="handleDeleteSchedule(record)">删除</a-button>
            </template>
          </template>
        </DataTable>
        <GlowButton style="margin-top: 16px" @click="showScheduleModal = true">创建任务</GlowButton>
        <a-modal v-model:open="showScheduleModal" title="创建定时任务" @ok="handleCreateSchedule">
          <a-form layout="vertical">
            <a-form-item label="名称" required><a-input v-model:value="scheduleForm.name" /></a-form-item>
            <a-form-item label="Cron表达式" required>
              <a-input v-model:value="scheduleForm.cron" placeholder="0 * * * *" />
              <div v-if="cronError" style="color: var(--neon-orange); font-size: 12px; margin-top: 4px">{{ cronError }}</div>
            </a-form-item>
          </a-form>
        </a-modal>
      </a-tab-pane>

      <!-- Tab 3: API Keys -->
      <a-tab-pane key="apikeys" tab="API密钥">
        <DataTable :columns="apiKeyColumns" :data-source="apiKeyStore.keys" :loading="apiKeyStore.loading">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'key_preview'"><MaskedText :full-text="record.key_preview" /></template>
            <template v-if="column.key === 'actions'">
              <a-button type="link" size="small" danger @click="apiKeyStore.deleteKey(record.id)">删除</a-button>
            </template>
          </template>
        </DataTable>
        <GlowButton style="margin-top: 16px" @click="showApiKeyModal = true">创建密钥</GlowButton>
        <a-modal v-model:open="showApiKeyModal" title="创建API密钥" @ok="handleCreateApiKey">
          <a-form layout="vertical"><a-form-item label="名称" required><a-input v-model:value="apiKeyForm.name" /></a-form-item></a-form>
        </a-modal>
      </a-tab-pane>

      <!-- Tab 4: Environment Variables -->
      <a-tab-pane key="envvars" tab="环境变量">
        <DataTable :columns="envColumns" :data-source="envVars" :loading="loading" />
      </a-tab-pane>

      <!-- Tab 5: Payment Config (NEW) -->
      <a-tab-pane key="payment" tab="支付配置">
        <NeonCard title="支付宝配置" style="margin-bottom: 16px">
          <a-form layout="vertical">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="App ID"><a-input v-model:value="paymentForm.alipayAppId" placeholder="支付宝应用ID" /></a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="商户私钥"><a-input-password v-model:value="paymentForm.alipayPrivateKey" placeholder="应用私钥" /></a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="支付宝公钥"><a-input v-model:value="paymentForm.alipayPublicKey" placeholder="支付宝公钥" /></a-form-item>
            <a-form-item label="回调地址"><a-input v-model:value="paymentForm.alipayNotifyUrl" placeholder="https://..." /></a-form-item>
          </a-form>
        </NeonCard>

        <NeonCard title="微信支付配置" style="margin-bottom: 16px">
          <a-form layout="vertical">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="App ID"><a-input v-model:value="paymentForm.wechatAppId" placeholder="微信AppID" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="商户号"><a-input v-model:value="paymentForm.wechatMchId" placeholder="微信商户号" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="API密钥"><a-input-password v-model:value="paymentForm.wechatApiKey" placeholder="API密钥" /></a-form-item>
              </a-col>
            </a-row>
          </a-form>
        </NeonCard>

        <GlowButton :loading="savingPayment" @click="handleSavePayment">保存支付配置</GlowButton>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { get, post, put } from '@/api/index';
import { useScheduleStore } from '@/stores/schedules';
import { useApiKeyStore } from '@/stores/apiKeys';
import { validateCronExpr } from '@/utils/cron-validator';
import { message } from 'ant-design-vue';
import DataTable from '@/components/common/DataTable.vue';
import NeonTag from '@/components/neon/NeonTag.vue';
import NeonCard from '@/components/neon/NeonCard.vue';
import MaskedText from '@/components/common/MaskedText.vue';
import GlowButton from '@/components/neon/GlowButton.vue';

// ---- Tabs ----
const activeTab = ref('webhooks');
const loading = ref(false);

// ---- Webhooks ----
const webhookLogs = ref<any[]>([]);
const webhookColumns = [
  { title: 'URL', dataIndex: 'url', key: 'url' },
  { title: '状态', key: 'status', width: 100 },
  { title: '时间', dataIndex: 'timestamp', key: 'time', width: 180 },
  { title: '操作', key: 'actions', width: 80 },
];

async function handleTestWebhook(record: any) {
  try {
    await post(`/webhooks/${record.id}/test`);
    message.success('Webhook 测试请求已发送');
  } catch {
    message.error('测试失败');
  }
}

// ---- Schedules ----
const scheduleStore = useScheduleStore();
const showScheduleModal = ref(false);
const scheduleForm = reactive({ name: '', cron: '' });
const cronError = ref('');
const scheduleColumns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: 'Cron', dataIndex: 'cron', key: 'cron', width: 120 },
  { title: '启用', key: 'enabled', width: 80 },
  { title: '操作', key: 'actions', width: 100 },
];

async function handleCreateSchedule() {
  if (!scheduleForm.name.trim()) { message.warning('请输入名称'); return; }
  if (!scheduleForm.cron.trim()) { message.warning('请输入Cron表达式'); return; }
  const result = validateCronExpr(scheduleForm.cron);
  if (!result.valid) { cronError.value = result.error ?? '无效的Cron表达式'; return; }
  cronError.value = '';
  await scheduleStore.createSchedule(scheduleForm);
  showScheduleModal.value = false;
  scheduleForm.name = ''; scheduleForm.cron = '';
  message.success('任务已创建');
}

async function handleDeleteSchedule(record: any) {
  await scheduleStore.deleteSchedule(record.id);
}

// ---- API Keys ----
const apiKeyStore = useApiKeyStore();
const showApiKeyModal = ref(false);
const apiKeyForm = reactive({ name: '' });
const apiKeyColumns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '密钥', key: 'key_preview', width: 200 },
  { title: '创建时间', dataIndex: 'created_at', key: 'time', width: 180 },
  { title: '操作', key: 'actions', width: 80 },
];

async function handleCreateApiKey() {
  if (!apiKeyForm.name.trim()) { message.warning('请输入名称'); return; }
  await apiKeyStore.createKey(apiKeyForm);
  showApiKeyModal.value = false;
  apiKeyForm.name = '';
  message.success('密钥已创建');
}

// ---- Env Vars ----
const envVars = ref<any[]>([]);
const envColumns = [
  { title: '变量名', dataIndex: 'name', key: 'name' },
  { title: '值', dataIndex: 'value', key: 'value' },
];

// ---- Payment Config ----
const savingPayment = ref(false);
const paymentForm = reactive({
  alipayAppId: '',
  alipayPrivateKey: '',
  alipayPublicKey: '',
  alipayNotifyUrl: '',
  wechatAppId: '',
  wechatMchId: '',
  wechatApiKey: '',
});

async function loadPaymentConfig() {
  try {
    const cfg = await get<any>('/config/payment');
    if (cfg) Object.assign(paymentForm, cfg);
  } catch { /* empty */ }
}

async function handleSavePayment() {
  savingPayment.value = true;
  try {
    await put('/config/payment', paymentForm);
    message.success('支付配置已保存');
  } catch {
    message.error('保存失败');
  } finally {
    savingPayment.value = false;
  }
}

// ---- Init ----
onMounted(async () => {
  scheduleStore.fetchSchedules();
  apiKeyStore.fetchKeys();
  try { webhookLogs.value = await get('/webhooks'); } catch {}
  try { envVars.value = await get('/env-vars'); } catch {}
  loadPaymentConfig();
});
</script>
