<template>
  <div>
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="12">
        <NeonCard title="推送统计">
          <BarChart v-if="barData.length" :data="barData" />
          <EmptyState v-else description="暂无推送统计" />
        </NeonCard>
      </a-col>
    </a-row>
    <DataTable :columns="columns" :data-source="store.notifications" :loading="store.loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'delivery_status'">
          <NeonTag :color="record.delivery_status === 'delivered' ? 'green' : record.delivery_status === 'failed' ? 'red' : 'orange'">{{ record.delivery_status }}</NeonTag>
        </template>
      </template>
    </DataTable>
    <GlowButton style="margin-top: 16px" @click="showSendModal = true">发送通知</GlowButton>
    <a-modal v-model:open="showSendModal" title="发送通知" @ok="handleSend">
      <a-form layout="vertical">
        <a-form-item label="标题"><a-input v-model:value="sendForm.title" /></a-form-item>
        <a-form-item label="内容"><a-textarea v-model:value="sendForm.content" :rows="4" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { usePushStore } from '@/stores/push';
import { message } from 'ant-design-vue';
import NeonCard from '@/components/neon/NeonCard.vue';
import BarChart from '@/components/charts/BarChart.vue';
import DataTable from '@/components/common/DataTable.vue';
import NeonTag from '@/components/neon/NeonTag.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import GlowButton from '@/components/neon/GlowButton.vue';

const store = usePushStore();
const showSendModal = ref(false);
const sendForm = reactive({ title: '', content: '' });

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '标题', dataIndex: 'title', key: 'title', width: 200 },
  { title: '状态', key: 'delivery_status', width: 100 },
  { title: '时间', dataIndex: 'created_at', key: 'time', width: 180 },
];

const barData = computed(() => [
  { name: 'APNs', value: 85 },
  { name: 'FCM', value: 92 },
  { name: 'WebPush', value: 78 },
]);

async function handleSend() {
  await store.sendNotification(sendForm);
  showSendModal.value = false;
  message.success('通知已发送');
}

onMounted(() => store.fetchNotifications());
</script>