<template>
  <div>
    <SearchFilter :show-search="true" @search="handleSearch">
      <template #filters>
        <a-select v-model:value="statusFilter" placeholder="审核状态" allow-clear style="width: 120px" @change="fetchData">
          <a-select-option value="pending">待审核</a-select-option>
          <a-select-option value="approved">已批准</a-select-option>
          <a-select-option value="rejected">已拒绝</a-select-option>
        </a-select>
      </template>
    </SearchFilter>
    <DataTable :columns="columns" :data-source="store.skills" :loading="store.loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'security_status'">
          <NeonTag :color="record.security_status === 'approved' ? 'green' : record.security_status === 'pending' ? 'orange' : 'red'">{{ record.security_status }}</NeonTag>
        </template>
        <template v-if="column.key === 'actions'">
          <a-button type="link" size="small" @click="viewDetail(record)">详情</a-button>
          <a-button v-if="record.security_status === 'pending'" type="link" size="small" @click="handleApprove(record)">批准</a-button>
          <a-button v-if="record.security_status === 'pending'" type="link" size="small" danger @click="handleReject(record)">拒绝</a-button>
        </template>
      </template>
    </DataTable>
    <DetailDrawer ref="drawerRef" title="技能详情" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSkillStore } from '@/stores/skills';
import SearchFilter from '@/components/common/SearchFilter.vue';
import DataTable from '@/components/common/DataTable.vue';
import NeonTag from '@/components/neon/NeonTag.vue';
import DetailDrawer from '@/components/common/DetailDrawer.vue';
import type { Skill } from '@/types';

const store = useSkillStore();
const drawerRef = ref();
const statusFilter = ref<string>();

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '分类', dataIndex: 'category', key: 'category', width: 120 },
  { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
  { title: '评分', dataIndex: 'rating', key: 'rating', width: 80 },
  { title: '安装量', dataIndex: 'install_count', key: 'installs', width: 100 },
  { title: '审核状态', key: 'security_status', width: 100 },
  { title: '操作', key: 'actions', width: 180 },
];

function fetchData() { store.statusFilter = statusFilter.value ?? ''; store.fetchSkills(); }
function handleSearch(keyword: string) { store.fetchSkills({ search: keyword }); }
function viewDetail(record: Skill) { drawerRef.value?.open(); }
function handleApprove(record: Skill) { store.approveSkill(record.id); }
function handleReject(record: Skill) { store.rejectSkill(record.id); }

onMounted(fetchData);
</script>