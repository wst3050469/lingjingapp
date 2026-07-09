<template>
  <a-layout-header class="top-header">
    <div class="header-left">
      <!-- Main sidebar toggle -->
      <a-button
        v-if="!isMobile"
        type="text"
        @click="$emit('toggleMain')"
        class="toggle-btn"
        :aria-label="mainCollapsed ? '展开主侧栏' : '折叠主侧栏'"
      >
        <MenuFoldOutlined v-if="!mainCollapsed" />
        <MenuUnfoldOutlined v-else />
      </a-button>

      <!-- Sub sidebar toggle -->
      <a-button
        v-if="!isMobile"
        type="text"
        @click="$emit('toggleSub')"
        class="toggle-btn sub-toggle-btn"
        :aria-label="subCollapsed ? '展开子侧栏' : '折叠子侧栏'"
      >
        <ColumnWidthOutlined />
      </a-button>

      <span class="page-title">{{ pageTitle }}</span>
    </div>
    <div class="header-right">
      <a-button type="text" @click="searchVisible = true">
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
    <GlobalSearch />
  </a-layout-header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSidebar } from '@/composables/useSidebar';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ColumnWidthOutlined,
  SearchOutlined,
  UserOutlined,
  KeyOutlined,
  LogoutOutlined,
} from '@ant-design/icons-vue';
import GlobalSearch from '@/components/search/GlobalSearch.vue';

defineProps<{
  mainCollapsed: boolean;
  subCollapsed: boolean;
}>();

defineEmits<{
  (e: 'toggleMain'): void;
  (e: 'toggleSub'): void;
}>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { isMobile } = useSidebar();
const searchVisible = ref(false);

const pageTitles: Record<string, string> = {
  '/': '仪表盘', '/devices': '设备管理', '/sessions': '会话管理', '/skills': '技能市场',
  '/memories': '记忆管理', '/push': '推送通知', '/defects': '缺陷管理', '/config': '系统配置',
  '/logs': '审计日志', '/versions': '版本管理', '/tenants': '租户管理', '/users': '用户管理',
  '/subscriptions': '订阅管理', '/payments': '支付管理',
};
const pageTitle = computed(() => pageTitles[route.path] ?? '管理后台');

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

function handleChangePassword() {
  /* TODO: open change password modal */
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

.sub-toggle-btn {
  opacity: 0.6;
}

.sub-toggle-btn:hover {
  opacity: 1;
}

.user-btn {
  color: var(--text-secondary);
}

.security-banner {
  margin-right: 16px;
}
</style>
