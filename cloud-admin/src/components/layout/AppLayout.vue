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
import { onMounted } from 'vue';
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
