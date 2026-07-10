<template>
  <a-layout class="app-layout">
    <!-- 主侧边栏 -->
    <MainSidebar
      v-if="!isMobile"
      :effectiveCollapsed="effectiveCollapsed"
      :isMobile="isMobile"
      @toggle="toggleMain"
    />

    <!-- 主内容区域 -->
    <a-layout
      class="layout-main"
      :style="{ marginLeft: mainWidth + 'px' }"
    >
      <TopHeader
        :mainCollapsed="effectiveCollapsed"
        @toggle-main="toggleMain"
      />
      <a-layout-content class="layout-content">
        <router-view />
      </a-layout-content>
    </a-layout>

    <!-- 移动端底部导航 -->
    <MobileNav v-if="isMobile" />
  </a-layout>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import MainSidebar from './MainSidebar.vue';
import TopHeader from './TopHeader.vue';
import MobileNav from './MobileNav.vue';
import { useSidebar } from '@/composables/useSidebar';
import { useAuthStore } from '@/stores/auth';

const {
  effectiveCollapsed,
  isMobile,
  mainWidth,
  toggleMain,
} = useSidebar();

const route = useRoute();

const pageTitles: Record<string, string> = {
  '/dashboard': '仪表盘', '/users': '用户管理', '/tenants': '租户管理',
  '/contracts': '合同管理', '/suppliers': '供应商管理', '/customers': '客户管理',
  '/invoices': '发票管理', '/finance': '财务管理', '/versions': '版本管理',
  '/audit-logs': '审计日志', '/sessions': '会话管理', '/samples': '样本管理',
  '/recipes': '配方管理', '/automation': '自动化任务', '/websocket': '在线监控',
};
const pageTitle = computed(() => pageTitles[route.path] ?? '管理后台');

const authStore = useAuthStore();
onMounted(() => {
  authStore.checkSession();
});
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: var(--colorBgLayout, #0a0a0f);
}

.layout-main {
  flex: 1;
  transition: margin-left 0.2s ease;
  min-height: 100vh;
}

.layout-content {
  padding: 24px;
  overflow-y: auto;
  min-height: calc(100vh - 64px);
}
</style>
