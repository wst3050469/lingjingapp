<template>
  <div>
    <SearchFilter @search="handleSearch">
      <template #filters>
        <a-select v-model:value="statusFilter" placeholder="状态" allow-clear style="width: 120px" @change="fetchData">
          <a-select-option value="online">在线</a-select-option>
          <a-select-option value="offline">离线</a-select-option>
          <a-select-option value="disabled">禁用</a-select-option>
        </a-select>
      </template>
    </SearchFilter>
    <DataTable :columns="columns" :data-source="store.devices" :loading="store.loading" :total="store.total" :page="store.page" :page-size="store.pageSize" @page-change="handlePageChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <NeonTag :color="record.is_active ? 'green' : 'red'">{{ record.is_active ? '在线' : '离线' }}</NeonTag>
        </template>
        <template v-if="column.key === 'actions'">
          <a-button type="link" size="small" @click="viewDetail(record)">详情</a-button>
          <a-button type="link" size="small" @click="handleDelete(record)">删除</a-button>
        </template>
      </template>
    </DataTable>
    <DetailDrawer ref="drawerRef" title="设备详情" :width="640">
      <template v-if="currentDevice">
        <a-descriptions :column="1" bordered>
          <a-descriptions-item label="ID">{{ currentDevice.id }}</a-descriptions-item>
          <a-descriptions-item label="名称">{{ currentDevice.device_name }}</a-descriptions-item>
          <a-descriptions-item label="平台">{{ currentDevice.device_type }}</a-descriptions-item>
          <a-descriptions-item label="推送Token"><MaskedText :full-text="currentDevice.push_token" /></a-descriptions-item>
        </a-descriptions>
      </template>
    </DetailDrawer>
    <ConfirmModal ref="confirmRef" danger title="删除设备" content="确定要删除此设备吗？" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDeviceStore } from '@/stores/devices';
import SearchFilter from '@/components/common/SearchFilter.vue';
import DataTable from '@/components/common/DataTable.vue';
import NeonTag from '@/components/neon/NeonTag.vue';
import DetailDrawer from '@/components/common/DetailDrawer.vue';
import MaskedText from '@/components/common/MaskedText.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import type { Device } from '@/types';

const store = useDeviceStore();
const drawerRef = ref();
const confirmRef = ref();
const statusFilter = ref<string>();
const currentDevice = ref<Device>();

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 120 },
  { title: '名称', dataIndex: 'device_name', key: 'name', width: 200 },
  { title: '平台', dataIndex: 'device_type', key: 'platform', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '最后活跃', dataIndex: 'last_connected_at', key: 'last_seen', width: 180 },
  { title: '操作', key: 'actions', width: 150 },
];

function fetchData() { store.fetchDevices({ status: statusFilter.value }); }
function handleSearch(keyword: string) { store.fetchDevices({ search: keyword, status: statusFilter.value }); }
function handlePageChange(page: number, pageSize: number) { store.page = page; store.pageSize = pageSize; fetchData(); }
function viewDetail(record: Device) { currentDevice.value = record; drawerRef.value?.open(); }
async function handleDelete(record: Device) { try { await confirmRef.value?.show(); await store.deleteDevice(record.id); } catch {} }

onMounted(fetchData);
</script>