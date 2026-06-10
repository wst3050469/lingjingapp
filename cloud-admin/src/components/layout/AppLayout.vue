<template>
  <a-layout class="app-layout">
    <!-- Main Sidebar -->
    <MainSidebar
      v-if="!isMobile"
      :effectiveCollapsed="effectiveCollapsed"
      :isMobile="isMobile"
      @toggle="toggleMain"
    />

    <!-- Sub Sidebar (between main sidebar and content) -->
    <SubSidebar
      v-if="!isMobile"
      :subWidth="subWidth"
      :currentPageTitle="pageTitle"
      :style="{ left: mainWidth + 'px' }"
      @toggle="toggleSub"
    >
      <!-- Per-page sub-nav content injected via named slots by router-view:
           each page can define its own sub-nav by providing route.meta.subNav -->
    </SubSidebar>

    <!-- Main content area -->
    <a-layout
      class="layout-main"
      :style="{
        marginLeft: (mainWidth + subWidth) + 'px',
      }"
    >
      <TopHeader
        :mainCollapsed="effectiveCollapsed"
        :subCollapsed="subCollapsed"
        @toggle-main="toggleMain"
        @toggle-sub="toggleSub"
      />
      <a-layout-content class="layout-content">
        <router-view />
      </a-layout-content>
    </a-layout>

    <!-- Mobile bottom nav -->
    <MobileNav v-if="isMobile" />
  </a-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import MainSidebar from './MainSidebar.vue';
import SubSidebar from './SubSidebar.vue';
import TopHeader from './TopHeader.vue';
import MobileNav from './MobileNav.vue';
import { useSidebar } from '@/composables/useSidebar';

const {
  effectiveCollapsed,
  subCollapsed,
  isMobile,
  mainWidth,
  subWidth,
  toggleMain,
  toggleSub,
} = useSidebar();

const route = useRoute();

const pageTitles: Record<string, string> = {
  '/': '仪表盘',
  '/devices': '设备管理', '/sessions': '会话管理', '/skills': '技能市场',
  '/memories': '记忆管理', '/push': '推送通知', '/defects': '缺陷管理', '/config': '系统配置',
  '/logs': '审计日志', '/versions': '版本管理', '/users': '用户管理',
  '/subscriptions': '订阅管理', '/payments': '支付管理',
};
const pageTitle = computed(() => pageTitles[route.path] ?? '管理后台');
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
  min-height: calc(100vh - 64px); /* subtract header height */
}
</style>
