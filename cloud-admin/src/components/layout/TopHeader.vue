<template>
  <a-layout-header class="top-header">
    <div class="header-left">
      <!-- 主侧栏收起/展开按钮 -->
      <a-button
        v-if="!isMobile"
        type="text"
        @click="$emit('toggleMain')"
        class="toggle-btn"
        :aria-label="mainCollapsed ? '展开侧栏' : '折叠侧栏'"
      >
        <MenuFoldOutlined v-if="!mainCollapsed" />
        <MenuUnfoldOutlined v-else />
      </a-button>

      <span class="page-title">{{ pageTitle }}</span>
    </div>
    <div class="header-right">
      <a-button type="text" @click="searchRef?.open()">
        <SearchOutlined />
      </a-button>
      <a-dropdown>
        <a-button type="text" class="user-btn">
          <UserOutlined /> {{ authStore.user?.username ?? 'Admin' }}
        </a-button>
        <template #overlay>
          <a-menu>
            <a-menu-item @click="handleChangePassword">
              <KeyOutlined /> 修改密码
            </a-menu-item>
            <a-menu-item @click="handleLogout">
              <LogoutOutlined /> 退出登录
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>
    <GlobalSearch ref="searchRef" />
  </a-layout-header>
  <ChangePasswordModal ref="changePwdModal" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSidebar } from '@/composables/useSidebar';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  UserOutlined,
  KeyOutlined,
  LogoutOutlined,
} from '@ant-design/icons-vue';
import GlobalSearch from '@/components/search/GlobalSearch.vue';
import ChangePasswordModal from '@/components/common/ChangePasswordModal.vue';

defineProps<{
  mainCollapsed: boolean;
}>();

defineEmits<{
  (e: 'toggleMain'): void;
}>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { isMobile } = useSidebar();
const searchRef = ref<InstanceType<typeof GlobalSearch>>();
const changePwdModal = ref<InstanceType<typeof ChangePasswordModal>>();

const pageTitles: Record<string, string> = {
  '/': '仪表盘', '/dashboard': '仪表盘',
  '/sessions': '会话管理', '/audit-logs': '审计日志',
  '/versions': '版本管理', '/tenants': '租户管理', '/users': '用户管理',
  '/automation': '自动化任务', '/websocket': '在线监控',
};
const pageTitle = computed(() => pageTitles[route.path] ?? '管理后台');

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

function handleChangePassword() {
  changePwdModal.value?.open();
}
</script>

<style scoped>
.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--dark-800);
  border-bottom: var(--border-subtle);
  height: 64px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.toggle-btn {
  color: var(--text-secondary);
}

.toggle-btn:hover {
  color: var(--neon-cyan);
}

.user-btn {
  color: var(--text-secondary);
}
</style>
